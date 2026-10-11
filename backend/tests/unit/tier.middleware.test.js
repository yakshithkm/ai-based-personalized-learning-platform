jest.mock('../../src/services/tier/usageService');
const usage = require('../../src/services/tier/usageService');
const {
  requireTier, requireFeature, checkUsageLimit, requireUsageAvailable,
} = require('../../src/middleware/tierMiddleware');
const { shapeAnalyticsForTier } = require('../../src/services/tier/analyticsShaper');

const makeRes = () => {
  const res = { statusCode: 200, locals: {}, body: null, handlers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.once = (evt, fn) => { res.handlers[evt] = fn; };
  return res;
};
const run = async (mw, req) => {
  const res = makeRes();
  let nextCalled = false;
  await mw(req, res, (err) => { if (err) throw err; nextCalled = true; });
  return { res, nextCalled };
};
const userReq = (tier, extra = {}) => ({ user: { _id: 'u1', tier, ...extra }, body: {}, headers: {} });

beforeEach(() => jest.resetAllMocks());

describe('requireFeature', () => {
  test('Free user calling a PRO feature -> 403 TIER_UPGRADE_REQUIRED with the documented body', async () => {
    const { res, nextCalled } = await run(requireFeature('ADVANCED_ANALYTICS'), userReq('FREE'));
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      code: 'TIER_UPGRADE_REQUIRED',
      feature: 'ADVANCED_ANALYTICS',
      requiredTier: 'PRO',
      currentTier: 'FREE',
      message: 'This feature requires a Pro subscription.',
    });
  });

  test('Free and Pro users calling a PREMIUM feature are refused; Premium passes', async () => {
    expect((await run(requireFeature('ADVANCED_AI_TUTOR'), userReq('FREE'))).res.statusCode).toBe(403);
    const pro = await run(requireFeature('ADVANCED_AI_TUTOR'), userReq('PRO'));
    expect(pro.res.body).toMatchObject({ requiredTier: 'PREMIUM', currentTier: 'PRO' });
    expect((await run(requireFeature('ADVANCED_AI_TUTOR'), userReq('PREMIUM'))).nextCalled).toBe(true);
  });

  test('a tier smuggled in the body / headers / query is ignored - only the DB user counts', async () => {
    const req = userReq('FREE');
    req.body = { tier: 'PREMIUM', user: { tier: 'PREMIUM' } };
    req.headers = { 'x-tier': 'PREMIUM' };
    req.query = { tier: 'PREMIUM' };
    expect((await run(requireFeature('ADVANCED_AI_TUTOR'), req)).res.statusCode).toBe(403);
  });

  test('a stale req.tierContext cannot be forged from outside: it is derived from req.user', async () => {
    // protect() sets tierContext from the database row; with no context the middleware derives it.
    expect((await run(requireFeature('ADVANCED_ANALYTICS'), userReq('PRO'))).nextCalled).toBe(true);
  });

  test('lapsed subscription -> SUBSCRIPTION_EXPIRED, not a generic upgrade prompt', async () => {
    const req = userReq('PRO', { subscriptionStatus: 'ACTIVE', subscriptionEndDate: new Date('2020-01-01') });
    const { res } = await run(requireFeature('ADVANCED_ANALYTICS'), req);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'SUBSCRIPTION_EXPIRED', currentTier: 'FREE', requiredTier: 'PRO' });
  });

  test('unauthenticated -> 401 UNAUTHORIZED', async () => {
    const { res } = await run(requireFeature('ADVANCED_ANALYTICS'), { headers: {} });
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  test('a mistyped feature key fails at route-definition time, not silently open', () => {
    expect(() => requireFeature('ADVANCED_ANALYTIKS')).toThrow(/unknown feature/);
    expect(() => requireTier('GOLD')).toThrow(/unknown tier/);
    expect(() => checkUsageLimit('NOPE')).toThrow(/unknown usage key/);
  });
});

describe('requireTier', () => {
  test('orders FREE < PRO < PREMIUM', async () => {
    expect((await run(requireTier('PRO'), userReq('FREE'))).res.statusCode).toBe(403);
    expect((await run(requireTier('PRO'), userReq('PRO'))).nextCalled).toBe(true);
    expect((await run(requireTier('PRO'), userReq('PREMIUM'))).nextCalled).toBe(true);
    expect((await run(requireTier('PREMIUM'), userReq('PRO'))).res.statusCode).toBe(403);
  });
});

describe('checkUsageLimit', () => {
  const resetsAt = new Date('2026-10-05T18:30:00Z');

  test('reserves against the SERVER-resolved tier and lets the request through', async () => {
    usage.reserveUsage.mockResolvedValue({ ok: true, used: 1, limit: 5, remaining: 4, resetsAt, reservation: { r: 1 } });
    const req = userReq('FREE');
    req.body = { tier: 'PREMIUM' };
    const { nextCalled } = await run(checkUsageLimit('AI'), req);
    expect(nextCalled).toBe(true);
    expect(usage.reserveUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', tier: 'FREE', usageKey: 'AI' }));
  });

  test('limit reached -> 429 USAGE_LIMIT_REACHED with reset time and the upgrade target', async () => {
    usage.reserveUsage.mockResolvedValue({ ok: false, used: 5, limit: 5, unlimited: false, remaining: 0, resetsAt, reservation: null });
    const { res, nextCalled } = await run(checkUsageLimit('AI'), userReq('FREE'));
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({
      success: false, code: 'USAGE_LIMIT_REACHED', usageKey: 'AI', currentTier: 'FREE',
      requiredTier: 'PRO', limit: 5, used: 5, fairUse: false,
    });
    expect(res.body.resetsAt).toEqual(resetsAt);
  });

  test('a Premium fair-use ceiling is reported as fair use, with no upgrade target', async () => {
    usage.reserveUsage.mockResolvedValue({ ok: false, used: 300, limit: 300, unlimited: true, remaining: 0, resetsAt, reservation: null });
    const { res } = await run(checkUsageLimit('AI'), userReq('PREMIUM'));
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ fairUse: true, requiredTier: null, limit: null });
  });

  test('quota is refunded when the request fails, or the handler asks for a refund', async () => {
    const reservation = { r: 1 };
    usage.reserveUsage.mockResolvedValue({ ok: true, used: 1, limit: 5, remaining: 4, resetsAt, reservation });
    usage.releaseUsage.mockResolvedValue();

    let ran = await run(checkUsageLimit('PRACTICE'), userReq('FREE'));
    ran.res.statusCode = 400;
    ran.res.handlers.finish();
    expect(usage.releaseUsage).toHaveBeenCalledWith(reservation);

    usage.releaseUsage.mockClear();
    ran = await run(checkUsageLimit('AI'), userReq('FREE'));
    ran.res.locals.refundUsage = true; // e.g. Gemini failed mid-stream
    ran.res.handlers.finish();
    expect(usage.releaseUsage).toHaveBeenCalledTimes(1);

    usage.releaseUsage.mockClear();
    ran = await run(checkUsageLimit('AI'), userReq('FREE'));
    ran.res.handlers.finish(); // 200, no refund flag -> quota stays spent
    expect(usage.releaseUsage).not.toHaveBeenCalled();
  });
});

describe('requireUsageAvailable', () => {
  test('peeks without consuming', async () => {
    usage.peekUsage.mockResolvedValue({ ok: false, used: 20, limit: 20, unlimited: false, resetsAt: new Date() });
    const { res } = await run(requireUsageAvailable('PRACTICE'), userReq('FREE'));
    expect(res.statusCode).toBe(429);
    expect(usage.reserveUsage).not.toHaveBeenCalled();
  });
});

describe('analytics shaping removes data, not just UI', () => {
  const payload = () => ({
    performance: { totalAttempts: 40, topicStats: [{ topic: 'x' }], weeklyTrend: [1], conceptStats: [1] },
    topicMastery: [{ topic: 'x' }], topicHeatmap: [1], weeklyImprovement: [1], conceptMastery: [1],
    weakConceptPriority: [1], accuracyTrend: 'improving', timeAccuracyCorrelation: 0.4,
    improvementInsight: {}, transformation: {}, benchmark: { percentile: 80 },
    weakTopicPriority: [1, 2, 3, 4, 5], examReadiness: { score: 61, breakdown: { consistency: 70 } },
    readiness: { readinessScore: 61, status: 'ok', secret: 1 },
    mistakeBank: { recentMistakes: new Array(40).fill({}), repeatedMistakes: [] },
  });

  test('FREE: advanced analytics are absent from the response body', () => {
    const out = shapeAnalyticsForTier(payload(), 'FREE');
    expect(out.topicMastery).toEqual([]);
    expect(out.accuracyTrend).toBe('stable');
    expect(out.benchmark).toBeUndefined();
    expect(out.performance.topicStats).toBeUndefined();
    expect(out.performance.totalAttempts).toBe(40);
    expect(out.weakTopicPriority).toHaveLength(3);
    expect(out.examReadiness).toEqual({ score: 61, breakdown: {} });
    expect(out.mistakeBank.recentMistakes).toHaveLength(10);
    expect(JSON.stringify(out)).not.toMatch(/percentile|consistency/);
  });

  test('PRO: advanced analytics yes, readiness internals no', () => {
    const out = shapeAnalyticsForTier(payload(), 'PRO');
    expect(out.topicMastery).toHaveLength(1);
    expect(out.benchmark).toBeDefined();
    expect(out.examReadiness.breakdown).toEqual({});
    expect(out.mistakeBank.recentMistakes).toHaveLength(40);
  });

  test('PREMIUM: everything', () => {
    const out = shapeAnalyticsForTier(payload(), 'PREMIUM');
    expect(out.examReadiness.breakdown).toEqual({ consistency: 70 });
    expect(out.readiness.secret).toBe(1);
    expect(out.tierAccess).toMatchObject({ advancedAnalytics: true, readinessPredictions: true });
  });
});
