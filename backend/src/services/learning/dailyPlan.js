const DEFAULT_BUDGET_MINUTES = 45;

const contentRoute = (item) => `/learn/${item.id}`;
const practiceRoute = (id, count) => `/practice?mode=content-practice&rec=${id}&count=${count}`;

/**
 * Today's personalized sequence, generated from the student's real path + weak areas + due
 * mistakes (never a fixed template): the primary target's remaining path steps first, then one
 * different weak-area resource, then due mistake reviews, trimmed to a time budget.
 */
const buildDailyPlan = ({ primary, pathItems, weakItems, dueMistakes, budgetMinutes = DEFAULT_BUDGET_MINUTES }) => {
  const candidates = [];

  if (primary) {
    (primary.path || [])
      .filter((step) => step.status !== 'completed')
      .forEach((step) => {
        if (step.kind === 'content') {
          const item = pathItems.get(step.contentId) || (primary.content && primary.content.id === step.contentId ? primary : null);
          if (!item) return;
          candidates.push({
            type: 'content',
            title: step.title,
            stage: step.stage,
            minutes: step.minutes,
            subject: primary.target.subject,
            topic: primary.target.topic,
            reason: item.reason,
            recommendationReason: item.recommendationReason,
            recommendationId: item.id,
            route: contentRoute(item),
          });
        } else {
          candidates.push({
            type: 'practice',
            title: `Solve ${step.label}`,
            stage: 'practice',
            minutes: step.minutes,
            subject: primary.target.subject,
            topic: primary.target.topic,
            reason: `Test what you just learned in ${primary.target.topic}.`,
            recommendationReason: primary.recommendationReason,
            recommendationId: primary.id,
            route: practiceRoute(primary.id, step.count),
          });
        }
      });
  }

  const otherWeak = weakItems.find((item) => !primary || item.target.topic !== primary.target.topic);
  if (otherWeak) {
    candidates.push(
      otherWeak.content
        ? {
            type: 'content',
            title: otherWeak.content.title,
            stage: otherWeak.stage,
            minutes: otherWeak.content.estimatedMinutes,
            subject: otherWeak.target.subject,
            topic: otherWeak.target.topic,
            reason: otherWeak.reason,
            recommendationReason: otherWeak.recommendationReason,
            recommendationId: otherWeak.id,
            route: contentRoute(otherWeak),
          }
        : {
            type: 'practice',
            title: `Solve ${otherWeak.practice.count} ${otherWeak.practice.difficulty || 'Mixed'} ${otherWeak.target.topic} Questions`,
            stage: 'practice',
            minutes: otherWeak.practice.minutes,
            subject: otherWeak.target.subject,
            topic: otherWeak.target.topic,
            reason: otherWeak.reason,
            recommendationReason: otherWeak.recommendationReason,
            recommendationId: otherWeak.id,
            route: practiceRoute(otherWeak.id, otherWeak.practice.count),
          }
    );
  }

  if (dueMistakes > 0) {
    const count = Math.min(dueMistakes, 5);
    candidates.push({
      type: 'mistake-review',
      title: `Review ${count} due mistake${count === 1 ? '' : 's'}`,
      stage: 'revision',
      minutes: Math.max(3, count),
      subject: null,
      topic: null,
      reason: `${dueMistakes} mistake review${dueMistakes === 1 ? ' is' : 's are'} due for spaced repetition today.`,
      recommendationReason: 'spaced-review',
      recommendationId: null,
      route: '/mistake-bank',
    });
  }

  const items = [];
  let total = 0;
  candidates.forEach((candidate) => {
    if (items.length && total + candidate.minutes > budgetMinutes) return;
    total += candidate.minutes;
    items.push({ order: items.length + 1, ...candidate });
  });

  return { budgetMinutes, totalMinutes: total, items };
};

module.exports = { buildDailyPlan, DEFAULT_BUDGET_MINUTES };