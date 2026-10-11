const UsageCounter = require('../../models/UsageCounter');
const UsageVisit = require('../../models/UsageVisit');
const { USAGE_KEYS, USAGE_TIMEZONE } = require('../../config/tiers');
const { getEnforcedLimit, getTierLimits } = require('./tierService');

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar parts in the configured timezone. Deliberately NOT toISOString().slice(0, 10): that
// buckets by UTC and rolls dates back for UTC+ users (IST) - a known bug pattern in this repo.
const localParts = (date, timeZone = USAGE_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
};

const pad = (n) => String(n).padStart(2, '0');

const getPeriodKey = (period, now = new Date()) => {
  const { year, month, day } = localParts(now);
  return period === 'month' ? `${year}-${pad(month)}` : `${year}-${pad(month)}-${pad(day)}`;
};

// Instant at which the current period ends (start of the next local day / month).
const getPeriodResetAt = (period, now = new Date()) => {
  const { year, month, day } = localParts(now);
  const nextLocalMidnightAsUtc =
    period === 'month' ? Date.UTC(year, month, 1) : Date.UTC(year, month - 1, day + 1);
  const { year: ly, month: lm, day: ld } = localParts(now);
  const localNowAsUtc = Date.UTC(ly, lm - 1, ld, ...hms(now));
  const offsetMs = localNowAsUtc - now.getTime();
  return new Date(nextLocalMidnightAsUtc - offsetMs);
};

function hms(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: USAGE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return [get('hour'), get('minute'), get('second'), date.getMilliseconds()];
}

const resolveDef = (usageKey) => {
  const def = typeof usageKey === 'string' ? USAGE_KEYS[usageKey] : usageKey;
  if (!def) throw new Error(`Unknown usage key: ${usageKey}`);
  return def;
};

const isDuplicateKey = (error) => error && (error.code === 11000 || error.code === 11001);

/**
 * Atomically consumes `amount` from a counter if (and only if) it stays within the enforced limit.
 * One round trip, no read-then-write race: two concurrent requests can never both slip under the
 * limit. Returns { ok, used, limit, remaining, resetsAt, reservation }.
 */
const reserveUsage = async ({ userId, tier, usageKey, amount = 1, now = new Date() }) => {
  const def = resolveDef(usageKey);
  const { limit, unlimited } = getEnforcedLimit(tier, def.limitKey);
  const period = getPeriodKey(def.period, now);
  const resetsAt = getPeriodResetAt(def.period, now);
  const denied = (used) => ({ ok: false, used, limit, unlimited, remaining: 0, resetsAt, reservation: null });

  if (amount > limit) return denied(0);

  const filter = { user: userId, key: def.key, period, count: { $lte: limit - amount } };
  const update = {
    $inc: { count: amount },
    $setOnInsert: { expiresAt: new Date(resetsAt.getTime() + 2 * DAY_MS) },
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const doc = await UsageCounter.findOneAndUpdate(filter, update, { upsert: true, new: true });
      return {
        ok: true,
        used: doc.count,
        limit,
        unlimited,
        remaining: Math.max(limit - doc.count, 0),
        resetsAt,
        reservation: { userId, key: def.key, period, amount },
      };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // Either the counter is at its limit (the filter missed, so the upsert tried to insert a
      // duplicate) or two first-time upserts raced. Re-read to tell them apart.
      // eslint-disable-next-line no-await-in-loop
      const existing = await UsageCounter.findOne({ user: userId, key: def.key, period }).lean();
      if (existing && existing.count + amount > limit) return denied(existing.count);
    }
  }
  return denied(limit);
};

/**
 * Atomically opens the de-duplication window for one page visit. Resolves true for the first request
 * of that visit (who should charge) and false for duplicates arriving while it is still open (who
 * should not). The same visit id is charged again once `windowMs` has passed, so an id cannot be
 * replayed for free indefinitely.
 */
const claimWindow = async ({ userId, key, visit, windowMs, now = new Date() }) => {
  try {
    await UsageVisit.findOneAndUpdate(
      { user: userId, key, visit, until: { $lte: now } },
      {
        $set: {
          until: new Date(now.getTime() + windowMs),
          expireAt: new Date(now.getTime() + windowMs + 10 * 60 * 1000),
          outcome: 'pending',
        },
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    if (isDuplicateKey(error)) return false; // same visit still open -> already charged
    throw error;
  }
};

// Records whether the request that opened the visit was allowed (true) or refused (false).
const settleWindow = async ({ userId, key, visit, granted }) => {
  await UsageVisit.updateOne({ user: userId, key, visit }, { $set: { outcome: granted ? 'granted' : 'denied' } });
};

// For a duplicate request: waits (briefly) for the opener's outcome. Resolves 'granted' | 'denied',
// or 'pending' if the opener is still running after `timeoutMs`.
const waitForWindowOutcome = async ({ userId, key, visit, timeoutMs = 1500, intervalMs = 40 }) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const doc = await UsageVisit.findOne({ user: userId, key, visit }).select('outcome').lean();
    if (!doc) return 'granted'; // row already gone (expired / cleaned up): nothing to wait for
    if (doc.outcome && doc.outcome !== 'pending') return doc.outcome;
    if (Date.now() >= deadline) return 'pending';
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};

const releaseWindow = async ({ userId, key, visit }) => {
  await UsageVisit.updateOne({ user: userId, key, visit }, { $set: { until: new Date(0) } });
};

/** Gives back a reservation (e.g. the request failed validation, or the AI call produced nothing). */
const releaseUsage = async (reservation) => {
  if (!reservation) return;
  await UsageCounter.updateOne(
    { user: reservation.userId, key: reservation.key, period: reservation.period, count: { $gte: reservation.amount } },
    { $inc: { count: -reservation.amount } }
  );
};

/** Read-only check - used to stop reads (e.g. fetching questions) once a quota is exhausted. */
const peekUsage = async ({ userId, tier, usageKey, now = new Date() }) => {
  const def = resolveDef(usageKey);
  const { limit, unlimited } = getEnforcedLimit(tier, def.limitKey);
  const period = getPeriodKey(def.period, now);
  const doc = await UsageCounter.findOne({ user: userId, key: def.key, period }).select('count').lean();
  const used = doc?.count || 0;
  return {
    ok: used < limit,
    used,
    limit,
    unlimited,
    remaining: Math.max(limit - used, 0),
    resetsAt: getPeriodResetAt(def.period, now),
  };
};

/** Usage for every counter, shaped for the API (null limit = no plan limit). */
const getUsageSnapshot = async ({ userId, tier, now = new Date() }) => {
  const defs = Object.values(USAGE_KEYS);
  const rows = await UsageCounter.find({
    user: userId,
    $or: defs.map((def) => ({ key: def.key, period: getPeriodKey(def.period, now) })),
  })
    .select('key count')
    .lean();
  const byKey = new Map(rows.map((row) => [row.key, row.count]));
  const planLimits = getTierLimits(tier);

  return Object.fromEntries(
    defs.map((def) => {
      const planLimit = planLimits[def.limitKey];
      const used = byKey.get(def.key) || 0;
      const unlimited = planLimit === Infinity;
      return [
        def.key,
        {
          used,
          limit: unlimited ? null : planLimit,
          remaining: unlimited ? null : Math.max(planLimit - used, 0),
          unlimited,
          period: def.period,
          resetsAt: getPeriodResetAt(def.period, now),
        },
      ];
    })
  );
};

module.exports = {
  getPeriodKey,
  getPeriodResetAt,
  reserveUsage,
  claimWindow,
  releaseWindow,
  settleWindow,
  waitForWindowOutcome,
  releaseUsage,
  peekUsage,
  getUsageSnapshot,
};