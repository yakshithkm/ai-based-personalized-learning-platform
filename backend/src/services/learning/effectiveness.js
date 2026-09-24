const Attempt = require('../../models/Attempt');
const Performance = require('../../models/Performance');
const LearningRecommendation = require('../../models/LearningRecommendation');
const { MIN_ATTEMPTS_FOR_EFFECTIVENESS } = require('./constants');

const pct = (correct, total) => (total ? Number(((correct / total) * 100).toFixed(1)) : null);
const norm = (value) => String(value || '').trim().toLowerCase();

// Attempts that count as "practice on this recommendation's target": same subject + topic,
// and the same concept only when the recommendation was concept-level.
const scopeFilter = (userId, target) => {
  const filter = { user: userId, subject: target.subject, topic: target.topic };
  if (target.granularity === 'concept' && target.concept) filter.conceptTested = target.concept;
  return filter;
};

const masteryFor = (perf, target) => {
  if (!perf) return null;
  if (target.granularity === 'concept' && target.concept) {
    const row = (perf.conceptStats || []).find(
      (r) => r.subject === target.subject && norm(r.topic) === norm(target.topic) && norm(r.concept) === norm(target.concept)
    );
    return row ? Number(row.masteryScore) : null;
  }
  const rows = (perf.topicStats || []).filter(
    (r) => r.subject === target.subject && norm(r.topic) === norm(target.topic)
  );
  const attempts = rows.reduce((s, r) => s + Number(r.attempts || 0), 0);
  if (!attempts) return null;
  return Number((rows.reduce((s, r) => s + Number(r.masteryScore || 0) * Number(r.attempts || 0), 0) / attempts).toFixed(1));
};

/** "Before" snapshot: raw accuracy over the last <=10 attempts on the target + current mastery. */
const captureBefore = async (userId, target, now = new Date()) => {
  const [attempts, perf] = await Promise.all([
    Attempt.find(scopeFilter(userId, target)).sort({ createdAt: -1 }).limit(10).select('isCorrect').lean(),
    Performance.findOne({ user: userId }).select('topicStats conceptStats').lean(),
  ]);
  return {
    accuracy: pct(attempts.filter((a) => a.isCorrect).length, attempts.length),
    attempts: attempts.length,
    mastery: masteryFor(perf, target),
    capturedAt: now,
  };
};

const formatPct = (value) => `${Math.round(value)}%`;

/**
 * Compares accuracy on the target BEFORE the student started the learning path with the
 * first <=10 attempts on the same target AFTER completing it. Reports the difference; it
 * deliberately makes no causal claim ("after completing", never "because of").
 */
const evaluateEffectiveness = async (rec, { now = new Date(), persist = true } = {}) => {
  const base = {
    recommendationId: String(rec._id),
    completed: rec.status === 'completed',
    timeSpentSec: rec.timeSpentSec || 0,
  };

  if (rec.status !== 'completed' || !rec.completedAt) {
    return { ...base, available: false, reason: 'not-completed', message: 'Complete this learning path to see its effect on your accuracy.' };
  }

  const scope = scopeFilter(rec.user, rec.target);
  const afterFilter = { ...scope, createdAt: { $gte: rec.completedAt } };
  const [afterAttempts, totalAfter, perf] = await Promise.all([
    Attempt.find(afterFilter).sort({ createdAt: 1 }).limit(10).select('isCorrect').lean(),
    Attempt.countDocuments(afterFilter),
    Performance.findOne({ user: rec.user }).select('topicStats conceptStats').lean(),
  ]);

  const before = rec.before || {};
  const beforeAttempts = Number(before.attempts || 0);
  const after = {
    accuracy: pct(afterAttempts.filter((a) => a.isCorrect).length, afterAttempts.length),
    attempts: afterAttempts.length,
    mastery: masteryFor(perf, rec.target),
  };

  const topicLabel = rec.target.granularity === 'concept' && rec.target.concept ? rec.target.concept : rec.target.topic;
  const result = {
    ...base,
    before: { accuracy: before.accuracy ?? null, attempts: beforeAttempts, mastery: before.mastery ?? null },
    after,
    practiceAttemptsAfter: totalAfter,
    target: rec.target,
  };

  if (after.attempts < MIN_ATTEMPTS_FOR_EFFECTIVENESS) {
    const remaining = MIN_ATTEMPTS_FOR_EFFECTIVENESS - after.attempts;
    Object.assign(result, {
      available: false,
      reason: 'not-enough-practice',
      message: `Answer ${remaining} more ${topicLabel} question${remaining === 1 ? '' : 's'} to see how your accuracy changed after completing this path.`,
    });
  } else if (beforeAttempts < MIN_ATTEMPTS_FOR_EFFECTIVENESS || before.accuracy === null || before.accuracy === undefined) {
    Object.assign(result, {
      available: true,
      hasBaseline: false,
      delta: { accuracyPoints: null, mastery: null },
      message: `After completing this path your first ${after.attempts} ${topicLabel} questions were ${formatPct(after.accuracy)} accurate. There was no earlier practice in this area to compare against.`,
    });
  } else {
    const accuracyPoints = Number((after.accuracy - before.accuracy).toFixed(1));
    const masteryDelta =
      after.mastery !== null && before.mastery !== null && before.mastery !== undefined
        ? Number((after.mastery - before.mastery).toFixed(1))
        : null;
    const direction = accuracyPoints > 0 ? 'improved by' : accuracyPoints < 0 ? 'changed by' : 'stayed level, a change of';
    Object.assign(result, {
      available: true,
      hasBaseline: true,
      delta: { accuracyPoints, mastery: masteryDelta },
      message:
        `Your ${topicLabel} accuracy ${direction} ${Math.abs(accuracyPoints)} percentage point${Math.abs(accuracyPoints) === 1 ? '' : 's'} ` +
        `(${formatPct(before.accuracy)} before, ${formatPct(after.accuracy)} across ${after.attempts} questions after) once you completed this learning path.`,
    });
  }

  if (persist && after.attempts > 0) {
    await LearningRecommendation.updateOne(
      { _id: rec._id },
      {
        $set: {
          'after.accuracy': after.accuracy,
          'after.attempts': after.attempts,
          'after.mastery': after.mastery,
          'after.evaluatedAt': now,
          practiceAttemptsAfter: totalAfter,
        },
      }
    );
  }
  return result;
};

module.exports = { captureBefore, evaluateEffectiveness, scopeFilter, masteryFor };