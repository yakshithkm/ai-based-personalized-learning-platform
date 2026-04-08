const Mistake = require('../models/Mistake');

const REPETITION_DAYS = [1, 3, 7];

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const getNextReviewAt = (stage, baseDate = new Date()) => {
  const dayOffset = REPETITION_DAYS[Math.min(Math.max(stage, 0), REPETITION_DAYS.length - 1)];
  return addDays(baseDate, dayOffset);
};

const trackAttemptProgress = async ({
  userId,
  question,
  selectedAnswerIndex,
  selectedAnswerText,
  isCorrect,
}) => {
  const now = new Date();

  const openMistakes = await Mistake.find({
    user: userId,
    question: question._id,
    resolved: false,
  });

  if (!isCorrect) {
    await Mistake.create({
      user: userId,
      question: question._id,
      subject: question.subject,
      topic: question.topic,
      subtopic: question.subtopic || question.topic || 'General',
      difficulty: question.difficulty,
      selectedAnswerIndex,
      selectedAnswerText,
      repetitionStage: 0,
      nextReviewAt: getNextReviewAt(0, now),
      retryCount: 0,
      improvedOnRetry: false,
      resolved: false,
      lastAttemptCorrect: false,
      lastReviewedAt: now,
    });

    if (openMistakes.length) {
      await Promise.all(
        openMistakes.map((mistake) => {
          mistake.retryCount += 1;
          mistake.lastReviewedAt = now;
          mistake.lastAttemptCorrect = false;
          mistake.nextReviewAt = getNextReviewAt(0, now);
          return mistake.save();
        })
      );
    }

    return;
  }

  if (!openMistakes.length) {
    return;
  }

  await Promise.all(
    openMistakes.map((mistake) => {
      mistake.retryCount += 1;
      mistake.lastReviewedAt = now;
      mistake.lastAttemptCorrect = true;
      mistake.improvedOnRetry = true;

      if (mistake.repetitionStage >= 2) {
        mistake.resolved = true;
        mistake.resolvedAt = now;
        mistake.nextReviewAt = null;
        return mistake.save();
      }

      const nextStage = mistake.repetitionStage + 1;
      mistake.repetitionStage = nextStage;
      mistake.nextReviewAt = getNextReviewAt(nextStage, now);
      return mistake.save();
    })
  );
};

const getCommonMistakePattern = async ({ userId, topic, subtopic, selectedAnswerText }) => {
  if (!selectedAnswerText) {
    return { message: '', count: 0 };
  }

  const similarMistakeCount = await Mistake.countDocuments({
    user: userId,
    topic,
    subtopic: subtopic || topic || 'General',
    selectedAnswerText,
  });

  let message = '';

  if (similarMistakeCount >= 3) {
    message = `You often choose "${selectedAnswerText}" in ${topic}. Revisit the core rule and compare option traps before finalizing.`;
  } else if (similarMistakeCount === 2) {
    message = `This option pattern has appeared before in ${topic}. Slow down and eliminate distractor choices first.`;
  } else {
    message = `This seems to be a concept gap in ${topic}. Focus on definition-level understanding before solving mixed problems.`;
  }

  return {
    message,
    count: similarMistakeCount,
  };
};

const getMistakeBankForUser = async (userId) => {
  const [recentMistakes, repeatedMistakes, frequentFailedTopics, frequentFailedSubtopics, summary] = await Promise.all([
    Mistake.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('question subject topic subtopic difficulty repetitionStage nextReviewAt resolved retryCount improvedOnRetry createdAt'),
    Mistake.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$question',
          subject: { $first: '$subject' },
          topic: { $first: '$topic' },
          failures: { $sum: 1 },
          lastMistakeAt: { $max: '$createdAt' },
        },
      },
      { $match: { failures: { $gte: 2 } } },
      { $sort: { failures: -1, lastMistakeAt: -1 } },
      { $limit: 10 },
    ]),
    Mistake.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: { subject: '$subject', topic: '$topic' },
          failures: { $sum: 1 },
          lastMistakeAt: { $max: '$createdAt' },
        },
      },
      { $sort: { failures: -1, lastMistakeAt: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          subject: '$_id.subject',
          topic: '$_id.topic',
          failures: 1,
          lastMistakeAt: 1,
        },
      },
    ]),
    Mistake.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: { subject: '$subject', topic: '$topic', subtopic: '$subtopic' },
          failures: { $sum: 1 },
          lastMistakeAt: { $max: '$createdAt' },
        },
      },
      { $sort: { failures: -1, lastMistakeAt: -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          subject: '$_id.subject',
          topic: '$_id.topic',
          subtopic: '$_id.subtopic',
          failures: 1,
          lastMistakeAt: 1,
        },
      },
    ]),
    Mistake.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: {
            $sum: {
              $cond: [{ $eq: ['$resolved', false] }, 1, 0],
            },
          },
          improvedOnRetry: {
            $sum: {
              $cond: [{ $eq: ['$improvedOnRetry', true] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  return {
    recentMistakes,
    repeatedMistakes: repeatedMistakes.map((entry) => ({
      questionId: entry._id,
      subject: entry.subject,
      topic: entry.topic,
      failures: entry.failures,
      lastMistakeAt: entry.lastMistakeAt,
    })),
    frequentFailedTopics,
    frequentFailedSubtopics,
    summary: {
      totalMistakes: summary[0]?.total || 0,
      openMistakes: summary[0]?.open || 0,
      resolvedMistakes: Math.max((summary[0]?.total || 0) - (summary[0]?.open || 0), 0),
      improvedOnRetry: summary[0]?.improvedOnRetry || 0,
    },
  };
};

module.exports = {
  REPETITION_DAYS,
  getNextReviewAt,
  trackAttemptProgress,
  getCommonMistakePattern,
  getMistakeBankForUser,
};
