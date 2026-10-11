// consumeUsageOnce: duplicates of ONE page visit are charged once and inherit the opener's outcome
// (including when the opener just used the LAST unit); a separate visit is always charged.
jest.mock('../../src/services/tier/usageService');
const usage = require('../../src/services/tier/usageService');
const { consumeUsageOnce } = require('../../src/middleware/tierMiddleware');

const makeRes = () => {
  const res = { statusCode: 200, locals: {}, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.once = () => {};
  return res;
};
const makeReq = (visit = 'visit-abc-123') => ({
  user: { _id: 'u1', tier: 'FREE' },
  query: visit ? { visit } : {},
  body: {},
  headers: {},
});
const resetsAt = new Date('2026-10-11T18:30:00Z');
const okReserve = { ok: true, used: 1, limit: 5, remaining: 4, resetsAt, reservation: { r: 1 } };
const KEY = { userId: 'u1', key: 'RECOMMENDATIONS', visit: 'visit-abc-123' };

beforeEach(() => jest.resetAllMocks());

test('first request of a visit charges once and records a granted outcome', async () => {
  usage.claimWindow.mockResolvedValue(true);
  usage.reserveUsage.mockResolvedValue(okReserve);
  expect(await consumeUsageOnce(makeReq(), makeRes(), 'RECOMMENDATIONS')).toBe(true);
  expect(usage.reserveUsage).toHaveBeenCalledTimes(1);
  expect(usage.settleWindow).toHaveBeenCalledWith({ ...KEY, granted: true });
});

test('REGRESSION: the duplicate of the 5th visit (opener took the last unit) is allowed, not refused', async () => {
  usage.claimWindow.mockResolvedValue(false);
  usage.waitForWindowOutcome.mockResolvedValue('granted');
  usage.peekUsage.mockResolvedValue({ ok: false, used: 5, limit: 5, unlimited: false, resetsAt });
  const res = makeRes();
  expect(await consumeUsageOnce(makeReq(), res, 'RECOMMENDATIONS')).toBe(true);
  expect(res.statusCode).toBe(200);
  expect(usage.reserveUsage).not.toHaveBeenCalled();
});

test('a duplicate whose opener was refused is refused too', async () => {
  usage.claimWindow.mockResolvedValue(false);
  usage.waitForWindowOutcome.mockResolvedValue('denied');
  usage.peekUsage.mockResolvedValue({ ok: false, used: 5, limit: 5, unlimited: false, resetsAt });
  const res = makeRes();
  expect(await consumeUsageOnce(makeReq(), res, 'RECOMMENDATIONS')).toBe(false);
  expect(res.statusCode).toBe(429);
  expect(res.body.code).toBe('USAGE_LIMIT_REACHED');
});

test('the 6th visit (quota already spent) is refused and the outcome recorded as denied', async () => {
  usage.claimWindow.mockResolvedValue(true);
  usage.reserveUsage.mockResolvedValue({ ok: false, used: 5, limit: 5, unlimited: false, resetsAt, reservation: null });
  const res = makeRes();
  expect(await consumeUsageOnce(makeReq(), res, 'RECOMMENDATIONS')).toBe(false);
  expect(res.statusCode).toBe(429);
  expect(usage.settleWindow).toHaveBeenCalledWith({ ...KEY, granted: false });
});

test('an opener that throws releases the visit so a retry is charged normally', async () => {
  usage.claimWindow.mockResolvedValue(true);
  usage.reserveUsage.mockRejectedValue(new Error('db down'));
  usage.releaseWindow.mockResolvedValue();
  await expect(consumeUsageOnce(makeReq(), makeRes(), 'RECOMMENDATIONS')).rejects.toThrow('db down');
  expect(usage.releaseWindow).toHaveBeenCalledWith(KEY);
});

test('a duplicate whose opener is still in flight after the wait is allowed (the opener is charged)', async () => {
  usage.claimWindow.mockResolvedValue(false);
  usage.waitForWindowOutcome.mockResolvedValue('pending');
  expect(await consumeUsageOnce(makeReq(), makeRes(), 'RECOMMENDATIONS')).toBe(true);
  expect(usage.reserveUsage).not.toHaveBeenCalled();
});

test('a request without a visit id (e.g. a direct API call) is charged every time, no de-duplication', async () => {
  usage.reserveUsage.mockResolvedValue(okReserve);
  await consumeUsageOnce(makeReq(null), makeRes(), 'RECOMMENDATIONS');
  await consumeUsageOnce(makeReq(null), makeRes(), 'RECOMMENDATIONS');
  expect(usage.claimWindow).not.toHaveBeenCalled();
  expect(usage.reserveUsage).toHaveBeenCalledTimes(2);
});

test('a malformed visit id is ignored (treated as no visit id)', async () => {
  usage.reserveUsage.mockResolvedValue(okReserve);
  await consumeUsageOnce(makeReq('x'), makeRes(), 'RECOMMENDATIONS'); // too short
  await consumeUsageOnce(makeReq('bad id with spaces!!'), makeRes(), 'RECOMMENDATIONS');
  expect(usage.claimWindow).not.toHaveBeenCalled();
  expect(usage.reserveUsage).toHaveBeenCalledTimes(2);
});