const {
  WEIGHTS: W,
  PENALTIES: P,
  DIFFICULTIES,
  PATH_TEMPLATES,
} = require('./constants');
const {
  confidence,
  getTopicStat,
  getConceptStat,
  resolveNamedStat,
  topicKey,
  norm,
  daysBetween,
  dayKey,
} = require('./learnerProfile');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round1 = (value) => Number(Number(value).toFixed(1));
const rankOf = (difficulty) => {
  const idx = DIFFICULTIES.indexOf(difficulty);
  return idx === -1 ? 1 : idx;
};

const templateStages = (level) =>
  (PATH_TEMPLATES[level] || PATH_TEMPLATES.developing).filter((s) => s.stage).map((s) => s.stage);

// Which content difficulty suits a learner at this level, shifted one step by explicit
// "too easy / too difficult" feedback.
const targetDifficulty = (level, bias = 0) => {
  const base = { new: 0, low: 0, developing: 1, proficient: 1, high: 2 }[level] ?? 1;
  return DIFFICULTIES[clamp(base + bias, 0, 2)];
};

const preferredStages = (need) => {
  switch (need.type) {
    case 'spaced-review':
    case 'revision':
      return ['revision', 'worked-example'];
    case 'advanced-challenge':
      return ['advanced', 'worked-example'];
    case 'mistake-recovery':
      return ['explanation', 'worked-example', 'introduction'];
    case 'stagnation-break':
      return ['worked-example', 'explanation'];
    case 'new-topic':
    case 'cold-start':
      return ['introduction', 'explanation'];
    case 'exam-preparation':
      return ['worked-example', 'revision', 'advanced'];
    default:
      return templateStages(need.level);
  }
};

// First preferred stage the student has not yet completed for this topic.
const nextStageFor = (need, profile) => {
  const done = profile.completedStagesByTopic.get(topicKey(need.subject, need.topic)) || new Set();
  return preferredStages(need).find((stage) => !done.has(stage)) || null;
};

const matchLevelFor = (content, need) => {
  if (need.concept && content.concept && norm(content.concept) === norm(need.concept)) return 'concept';
  if (
    content.subtopic &&
    content.subtopic !== 'General' &&
    need.subtopic &&
    norm(content.subtopic) === norm(need.subtopic)
  ) {
    return 'subtopic';
  }
  return 'topic';
};

const appliesToNeed = (content, need) =>
  content.subject === need.subject && norm(content.topic) === norm(need.topic);

const syllabusIndex = (profile) => {
  if (!profile._syllabusIndex) {
    profile._syllabusIndex = new Map(profile.syllabus.map((s) => [topicKey(s.subject, s.topic), s]));
  }
  return profile._syllabusIndex;
};

// Prerequisite status of a resource for this student. Only a 'low' level on a resolvable
// prerequisite blocks; unknown / unresolvable prerequisites never gate content.
const prerequisiteStatus = (content, profile) => {
  const met = [];
  const unmet = [];
  const unknown = [];
  (content.prerequisites || []).forEach((name) => {
    const stat = resolveNamedStat(profile, content.subject, name);
    if (!stat) unknown.push(name);
    else if (stat.level === 'low') unmet.push({ name, accuracy: stat.accuracy, attempts: stat.attempts });
    else met.push(name);
  });
  return { met, unmet, unknown };
};

const priorityFor = (score, need) => {
  const urgentType = ['weak-topic', 'weak-concept', 'mistake-recovery', 'prerequisite'].includes(need.type);
  // Well-evidenced poor accuracy (>= 5 attempts, under 50%) is always high priority.
  const clearlyWeak = urgentType && need.signals?.attempts >= 5 && need.signals?.accuracy < 50;
  if (score >= 65 || clearlyWeak || (need.urgency >= 0.6 && urgentType)) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

const practicePriorityFor = (need) => (need.urgency >= 0.6 ? 'high' : need.urgency >= 0.35 ? 'medium' : 'low');

/**
 * Deterministic 0-100 recommendation score for one resource against one learning need.
 *
 *   Score = Need + Weakness + Mistake relevance + Mastery gap + Difficulty fit
 *         + Learning progression + Prerequisite relevance + Exam relevance + Freshness
 *         + Content quality + Recency/repetition + Feedback affinity        (positive max = 100)
 *         - Already-completed - Skipped - Recently-recommended-but-ignored
 *         - Difficulty mismatch - Advanced-too-early / Beginner-too-late - Unmet prerequisite
 *
 * clamped to 0..100. Pure function: no I/O, no randomness, no LLM.
 */
const scoreContent = ({ content, need, profile }) => {
  const matchLevel = matchLevelFor(content, need);
  const topicStat = getTopicStat(profile, need.subject, need.topic);
  const conceptStat =
    matchLevel === 'concept' || need.granularity === 'concept'
      ? getConceptStat(profile, need.subject, need.topic, need.concept)
      : null;
  const stat = conceptStat || topicStat;
  const attempts = stat?.attempts || 0;

  const catalog = syllabusIndex(profile).get(topicKey(need.subject, need.topic));
  const progress = profile.progressByContent.get(String(content._id));
  const hist = profile.history.get(String(content._id));
  const prereq = prerequisiteStatus(content, profile);

  const c = {};

  // Need: how urgent the underlying learning need is; a concept-level need is only
  // partially served by a resource that is about a different concept of the same topic.
  const needFactor = need.granularity === 'concept' && matchLevel !== 'concept' ? 0.7 : 1;
  c.need = W.need * need.urgency * needFactor;

  c.weakness = attempts ? W.weakness * ((100 - stat.accuracy) / 100) * confidence(attempts) : 0;

  const openMistakes = stat?.openMistakes || 0;
  const dueMistakes = stat?.dueMistakes || 0;
  c.mistake = W.mistake * clamp((openMistakes + 0.5 * dueMistakes) / 4, 0, 1);

  c.masteryGap = attempts ? W.masteryGap * ((100 - stat.mastery) / 100) : W.masteryGap * 0.6;

  const target = targetDifficulty(need.level, profile.feedback.difficultyBias);
  const diffGap = Math.abs(rankOf(content.difficulty) - rankOf(target));
  c.difficultyFit = W.difficultyFit * (1 - Math.min(1, diffGap / 2));

  const stages = preferredStages(need);
  const nextStage = nextStageFor(need, profile);
  if (nextStage && content.learningStage === nextStage) c.progression = W.progression;
  else if (stages.includes(content.learningStage)) c.progression = W.progression * 0.5;
  else c.progression = W.progression * 0.1;

  if (need.type === 'prerequisite') c.prerequisite = W.prerequisite;
  else if (prereq.unmet.length === 0 && prereq.met.length > 0) c.prerequisite = W.prerequisite * 0.4;
  else c.prerequisite = 0;

  const weightageFactor = { High: 1, Medium: 0.6, Low: 0.3 }[catalog?.weightage] ?? 0.5;
  c.exam = W.exam * (weightageFactor * 0.8 + (catalog?.pyqShare || 0) * 0.2);

  if (!hist || !hist.earlierServings) c.freshness = W.freshness;
  else if (hist.lastEarlierServedAt && daysBetween(hist.lastEarlierServedAt, profile.now) >= 7) c.freshness = W.freshness * 0.5;
  else c.freshness = 0;

  c.quality = W.quality * (Number(content.qualityScore ?? 70) / 100);

  const daysSince = stat?.daysSincePractice ?? null;
  if (['spaced-review', 'revision'].includes(need.type)) {
    c.recency = W.recency * (content.learningStage === 'revision' ? 1 : 0.5);
  } else if (['weak-topic', 'weak-concept'].includes(need.type) && daysSince !== null && daysSince >= 5) {
    c.recency = W.recency * 0.6;
  } else {
    c.recency = 0;
  }

  c.feedback = W.feedback * (profile.feedback.typeAffinity[content.contentType] || 0);

  // --- penalties ---
  const pen = {};
  pen.completed = 0;
  if (progress?.status === 'completed') {
    const revisitable =
      content.learningStage === 'revision' &&
      ['spaced-review', 'revision'].includes(need.type) &&
      daysBetween(progress.completedAt, profile.now) >= 14;
    pen.completed = revisitable ? P.completedRevisitable : P.completed;
  }

  pen.skipped = 0;
  if (progress && (progress.status === 'skipped' || progress.skipped) && progress.status !== 'completed') {
    pen.skipped =
      daysBetween(progress.lastAccessedAt || progress.updatedAt, profile.now) < 14 ? P.skippedRecent : P.skippedOld;
  }

  pen.ignored = hist && !hist.engaged ? Math.min(P.ignoredCap, P.ignoredPerDay * hist.ignoredDays) : 0;
  pen.unmetPrerequisite = need.type !== 'prerequisite' && prereq.unmet.length ? P.unmetPrerequisite : 0;
  pen.difficultyMismatch = diffGap >= 2 ? P.difficultyMismatch : 0;
  pen.advancedTooEarly =
    (content.learningStage === 'advanced' || content.difficulty === 'Hard') && ['new', 'low'].includes(need.level)
      ? P.advancedTooEarly
      : 0;
  pen.beginnerTooLate =
    need.level === 'high' &&
    content.difficulty === 'Easy' &&
    ['introduction', 'explanation'].includes(content.learningStage)
      ? P.beginnerTooLate
      : 0;

  const positive = Object.values(c).reduce((sum, v) => sum + v, 0);
  const negative = Object.values(pen).reduce((sum, v) => sum + v, 0);
  const score = Math.round(clamp(positive - negative, 0, 100));

  return {
    score,
    priority: priorityFor(score, need),
    matchLevel,
    stat,
    prereq,
    nextStage,
    components: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, round1(v)])),
    penalties: Object.fromEntries(Object.entries(pen).map(([k, v]) => [k, round1(v)])),
  };
};

const compareRanked = (a, b) =>
  b.score - a.score ||
  b.need.urgency - a.need.urgency ||
  Number(b.content.qualityScore ?? 0) - Number(a.content.qualityScore ?? 0) ||
  Number(b.content.popularityScore ?? 0) - Number(a.content.popularityScore ?? 0) ||
  String(a.content.title).localeCompare(String(b.content.title));

/** Best (content, need) pairing per resource, sorted best-first. */
const rankContents = ({ contents, needs, profile }) => {
  const best = new Map();
  contents.forEach((content) => {
    needs.forEach((need) => {
      if (!appliesToNeed(content, need)) return;
      const scored = scoreContent({ content, need, profile });
      const entry = { content, need, ...scored };
      const current = best.get(String(content._id));
      if (!current || compareRanked(entry, current) < 0) best.set(String(content._id), entry);
    });
  });
  return Array.from(best.values()).sort(compareRanked);
};

/**
 * Score for a practice-only recommendation (no study material for the target). Uses only the
 * components that apply without a resource - need, weakness, mistake relevance, mastery gap,
 * exam relevance, recency - and rescales them to 0-100 so it is comparable with content scores.
 */
const scorePracticeOnly = ({ need, profile }) => {
  const stat = getTopicStat(profile, need.subject, need.topic);
  const attempts = stat?.attempts || 0;
  const catalog = syllabusIndex(profile).get(topicKey(need.subject, need.topic));
  const weightageFactor = { High: 1, Medium: 0.6, Low: 0.3 }[catalog?.weightage] ?? 0.5;
  const daysSince = stat?.daysSincePractice ?? null;

  const parts = {
    need: W.need * need.urgency,
    weakness: attempts ? W.weakness * ((100 - stat.accuracy) / 100) * confidence(attempts) : 0,
    mistake: W.mistake * clamp(((stat?.openMistakes || 0) + 0.5 * (stat?.dueMistakes || 0)) / 4, 0, 1),
    masteryGap: attempts ? W.masteryGap * ((100 - stat.mastery) / 100) : W.masteryGap * 0.6,
    exam: W.exam * (weightageFactor * 0.8 + (catalog?.pyqShare || 0) * 0.2),
    recency:
      ['weak-topic', 'weak-concept'].includes(need.type) && daysSince !== null && daysSince >= 5 ? W.recency * 0.6 : 0,
  };
  const max = W.need + W.weakness + W.mistake + W.masteryGap + W.exam + W.recency;
  const raw = Object.values(parts).reduce((sum, v) => sum + v, 0);
  const score = Math.round(clamp((raw / max) * 100, 0, 100));
  return { score, priority: practicePriorityFor(need), components: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, round1(v)])) };
};

module.exports = {
  scoreContent,
  scorePracticeOnly,
  rankContents,
  compareRanked,
  appliesToNeed,
  matchLevelFor,
  prerequisiteStatus,
  targetDifficulty,
  preferredStages,
  nextStageFor,
  priorityFor,
  practicePriorityFor,
  dayKey,
};