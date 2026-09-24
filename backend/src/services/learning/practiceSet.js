const Attempt = require('../../models/Attempt');
const { fetchQuestionBatch } = require('../recommendationService');
const { PATH_TEMPLATES, DEFAULT_PRACTICE_COUNT } = require('./constants');
const { scopeFilter } = require('./effectiveness');

const practiceStepsForLevel = (level) =>
  (PATH_TEMPLATES[level] || PATH_TEMPLATES.developing).filter((s) => s.practice).map((s) => s.practice);

/**
 * Builds the "practice after learning" question set for a recommendation. Reuses the question
 * engine's fetchQuestionBatch and filters by subject / topic / subtopic / concept / difficulty.
 * Which step of the level's practice ladder (e.g. Easy -> Medium) applies is decided by how
 * many questions on this target the student has already answered since starting the path.
 * Answers are never included (same projection as /api/questions).
 */
const getPracticeSet = async ({ user, rec, count = DEFAULT_PRACTICE_COUNT }) => {
  const target = rec.target;
  const size = Math.min(Math.max(Number(count) || DEFAULT_PRACTICE_COUNT, 3), 10);
  const level = rec.signals?.level || 'developing';
  const steps = practiceStepsForLevel(level);

  const since = rec.completedAt || rec.startedAt || rec.recommendedAt;
  const scope = scopeFilter(user._id, target);
  const answeredSince = await Attempt.countDocuments({ ...scope, createdAt: { $gte: since } });
  const stepIndex = Math.min(Math.floor(answeredSince / size), Math.max(steps.length - 1, 0));
  const step = steps[stepIndex] || { count: size, difficulty: 'Medium' };

  const recent = await Attempt.find({ user: user._id, subject: target.subject, topic: target.topic })
    .sort({ createdAt: -1 })
    .limit(40)
    .select('question')
    .lean();
  const recentIds = new Set(recent.map((a) => String(a.question)));

  const conceptScoped = target.granularity === 'concept' && target.concept ? target.concept : undefined;
  const subtopic = target.subtopic && target.subtopic !== 'General' ? target.subtopic : undefined;
  const base = { targetExam: user.targetExam, subject: target.subject, topic: target.topic };

  // Progressively relax filters (previous-year tag -> concept/subtopic -> difficulty ->
  // recently-seen exclusion) so a valid set is returned whenever the topic has questions.
  const passes = [
    { subtopic, concept: conceptScoped, difficulty: step.difficulty || undefined, yearTag: step.yearTag, exclude: recentIds },
    { subtopic, concept: conceptScoped, difficulty: step.difficulty || undefined, exclude: recentIds },
    { subtopic, concept: conceptScoped, exclude: recentIds },
    { exclude: recentIds },
    { difficulty: step.difficulty || undefined, exclude: new Set() },
    { exclude: new Set() },
  ];

  const picked = new Map();
  for (const pass of passes) {
    if (picked.size >= size) break;
    // eslint-disable-next-line no-await-in-loop
    const batch = await fetchQuestionBatch({
      ...base,
      subtopic: pass.subtopic,
      concept: pass.concept,
      yearTag: pass.yearTag,
      difficulty: pass.difficulty,
      excludeIds: new Set([...pass.exclude, ...picked.keys()]),
      limit: size - picked.size,
    });
    batch.forEach((q) => picked.set(String(q._id), q));
  }

  const label = rec.target.granularity === 'concept' && rec.target.concept ? rec.target.concept : rec.target.topic;
  const questions = Array.from(picked.values())
    .slice(0, size)
    .map((q) => ({
      ...q,
      recommendationReason: 'content-practice',
      aiSignals: {
        labels: ['Practice after learning', `${q.difficulty || step.difficulty || 'Mixed'} level`],
        why: `Chosen from ${label} to test what you just learned.`,
        adaptiveDifficultyApplied: true,
      },
    }));

  return {
    recommendationId: String(rec._id),
    target,
    step: { index: stepIndex, count: size, difficulty: step.difficulty || null, previousYear: Boolean(step.yearTag), timed: Boolean(step.timed) },
    totalQuestions: questions.length,
    questions,
  };
};

module.exports = { getPracticeSet, practiceStepsForLevel };