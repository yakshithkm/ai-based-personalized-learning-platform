const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const Performance = require('../models/Performance');
const { rebuildPerformanceForUser } = require('../services/performanceService');
const { evaluateAdaptiveDifficulty } = require('../services/adaptiveDifficultyService');
const {
  buildImprovementTip,
  buildWhyGotWrong,
  getPerformanceLabel,
  classifyMistake,
  buildMotivationMessage,
  buildActionableFix,
  buildConfidenceInsight,
} = require('../services/feedbackService');
const {
  trackAttemptProgress,
  getCommonMistakePattern,
  getConceptMistakeSignal,
  getMistakeBankForUser,
} = require('../services/progressTracker');
const { trackProductEvent } = require('../services/eventTrackingService');

const pointsForAttempt = ({ isCorrect, timeTakenSec }) => {
  const base = isCorrect ? 12 : 5;
  const speedBonus = isCorrect && Number(timeTakenSec || 0) <= 35 ? 3 : 0;
  return base + speedBonus;
};

const difficultyRank = (difficulty) => {
  if (difficulty === 'Hard') return 2;
  if (difficulty === 'Medium') return 1;
  return 0;
};

const submitAttempt = async (req, res, next) => {
  try {
    const {
      questionId,
      selectedAnswerIndex,
      timeTakenSec,
      sessionId,
      questionIndex,
      totalQuestions,
      sessionMode,
    } = req.body;

    if (!questionId || selectedAnswerIndex === undefined || !timeTakenSec) {
      res.status(400);
      throw new Error('questionId, selectedAnswerIndex and timeTakenSec are required');
    }

    const question = await Question.findById(questionId);
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }

    const isCorrect = Number(selectedAnswerIndex) === question.correctAnswerIndex;
    const conceptTested = question.conceptTested || `${question.topic} Core Concept`;
    const expectedTimeSec = Number(question.solvingTimeEstimate || 60);
    const normalizedTaken = Number(timeTakenSec);

    const recentConceptAttempts = await Attempt.find({
      user: req.user._id,
      subject: question.subject,
      topic: question.topic,
      conceptTested,
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('isCorrect responsePace timeTakenSec expectedSolvingTimeSec')
      .lean();

    const recentStreak = recentConceptAttempts.reduce((streak, entry) => {
      if (!entry.isCorrect) return streak;
      return streak + 1;
    }, 0);

    const conceptMistakeFrequency = recentConceptAttempts.length
      ? recentConceptAttempts.filter((entry) => !entry.isCorrect).length / recentConceptAttempts.length
      : 0;

    const perfDoc = await Performance.findOne({ user: req.user._id }).select('topicStats');
    const subtopic = question.subtopic || question.topic || 'General';
    const topicEntry = perfDoc?.topicStats?.find(
      (row) =>
        row.subject === question.subject &&
        row.topic === question.topic &&
        (row.subtopic || 'General') === subtopic
    );
    const adaptiveDifficultyBefore = topicEntry?.currentDifficulty || question.difficulty || 'Medium';
    let adaptiveDifficultyAfter = evaluateAdaptiveDifficulty({
      currentDifficulty: adaptiveDifficultyBefore,
      topicAccuracy: topicEntry?.accuracy,
      isCorrect,
      timeTakenSec: normalizedTaken,
      expectedTimeSec,
      recentStreak,
      mistakeFrequency: conceptMistakeFrequency,
    });

    const fastWrongSignals = recentConceptAttempts.filter(
      (entry) => !entry.isCorrect && String(entry.responsePace || '') === 'fast'
    ).length + (!isCorrect && normalizedTaken <= expectedTimeSec * 0.8 ? 1 : 0);
    const correctiveModeActive = fastWrongSignals >= 2;

    if (
      correctiveModeActive &&
      difficultyRank(adaptiveDifficultyAfter) > difficultyRank(adaptiveDifficultyBefore)
    ) {
      adaptiveDifficultyAfter = adaptiveDifficultyBefore;
    }

    const responsePace = normalizedTaken <= expectedTimeSec * 0.8
      ? 'fast'
      : normalizedTaken > expectedTimeSec * 1.2
        ? 'slow'
        : 'on-time';

    const attempt = await Attempt.create({
      user: req.user._id,
      question: question._id,
      subject: question.subject,
      topic: question.topic,
      subtopic,
      conceptTested,
      difficulty: question.difficulty,
      selectedAnswerIndex,
      isCorrect,
      timeTakenSec,
      expectedSolvingTimeSec: expectedTimeSec,
      responsePace,
      adaptiveDifficultyBefore,
      adaptiveDifficultyAfter,
    });

    const performance = await rebuildPerformanceForUser(req.user._id);

    const correctAnswer = question.options[question.correctAnswerIndex];
    const selectedAnswerText = question.options[Number(selectedAnswerIndex)] || '';

    const conceptSignalBefore = await getConceptMistakeSignal({
      userId: req.user._id,
      conceptTested,
    });

    const mistakeClassification = classifyMistake({
      isCorrect,
      timeTakenSec: normalizedTaken,
      expectedTimeSec,
      selectedAnswerText,
      repeatedMistakeCount: conceptSignalBefore.repeatedCount,
      questionCommonMistake: question.commonMistake,
    });

    await trackAttemptProgress({
      userId: req.user._id,
      question,
      selectedAnswerIndex: Number(selectedAnswerIndex),
      selectedAnswerText,
      isCorrect,
      mistakeType: mistakeClassification,
      timeTakenSec: normalizedTaken,
      expectedTimeSec,
    });

    await trackProductEvent({
      userId: req.user._id,
      eventType: 'question_answered',
      metadata: {
        sessionId: sessionId || null,
        sessionMode: sessionMode || 'practice',
        questionId: String(question._id),
        questionIndex: Number(questionIndex || 0),
        totalQuestions: Number(totalQuestions || 0),
        topic: question.topic,
        subtopic,
        conceptTested,
        difficulty: question.difficulty,
        correctness: Boolean(isCorrect),
        timeTakenSec: normalizedTaken,
        expectedTimeSec,
        responsePace,
      },
    });

    const commonMistakePattern = await getCommonMistakePattern({
      userId: req.user._id,
      topic: question.topic,
      subtopic,
      selectedAnswerText,
    });

    const conceptSignal = await getConceptMistakeSignal({
      userId: req.user._id,
      conceptTested,
    });

    const confidenceInsight = buildConfidenceInsight({
      isCorrect,
      timeTakenSec: normalizedTaken,
      expectedTimeSec,
      selectedAnswerText,
    });

    const improvementTip = buildImprovementTip({
      isCorrect,
      timeTakenSec,
      topic: question.topic,
      difficulty: adaptiveDifficultyAfter,
      selectedAnswerText,
      conceptTested,
      expectedTimeSec,
      mistakeType: mistakeClassification,
      repeatedMistakeCount: conceptSignal.repeatedCount,
      responsePace,
    });

    const whyGotWrong = buildWhyGotWrong({
      isCorrect,
      topic: question.topic,
      conceptTested,
      mistakeType: mistakeClassification,
      commonMistakePattern: commonMistakePattern.message,
      selectedAnswerText,
      repeatedMistakeCount: conceptSignal.repeatedCount,
      responsePace,
    });

    const performanceLabel = getPerformanceLabel({
      topicAccuracy: topicEntry?.accuracy,
    });

    const actionableFix = buildActionableFix({
      mistakeType: mistakeClassification,
      conceptTested,
      topic: question.topic,
      confidenceInsight,
    });

    const motivationMessage = buildMotivationMessage({
      isCorrect,
      topic: question.topic,
      repeatedMistakeCount: conceptSignal.repeatedCount,
      performanceLabel,
      confidenceInsight,
    });

    const sessionInsight = isCorrect
      ? (confidenceInsight === 'slow-correct'
        ? `You are improving in ${conceptTested}, but speed is a hidden weakness.`
        : `You are improving in ${conceptTested}.`)
      : (conceptSignal.repeatedCount >= 2
        ? `You keep making the same mistake in ${conceptTested}.`
        : `You missed ${conceptTested}; one targeted retry can fix it.`);

    const correctivePressureMessage = correctiveModeActive
      ? 'You are consistently confident but incorrect in this concept. Slowing down and rebuilding fundamentals is recommended.'
      : '';

    const xpEarned = pointsForAttempt({ isCorrect, timeTakenSec: Number(timeTakenSec) });

    return res.status(201).json({
      message: 'Attempt submitted',
      attempt,
      result: {
        isCorrect,
        correctAnswerIndex: question.correctAnswerIndex,
        correctAnswer,
        explanation: question.explanation,
        conceptTested,
        commonMistake: question.commonMistake,
        expectedTimeSec,
        timeDeltaSec: Math.round(normalizedTaken - expectedTimeSec),
        confidenceInsight,
        improvementTip,
        whyGotWrong,
        actionableFix,
        performanceLabel,
        mistakeClassification,
        motivationMessage,
        xpEarned,
        mistakePatternCount: conceptSignal.repeatedCount,
        repeatedConceptMistakes: conceptSignal.repeatedCount,
        slowCorrectHistory: conceptSignal.slowCorrectCount,
        sessionInsight,
        correctivePressureActive: correctiveModeActive,
        correctivePressureMessage,
        actions: {
          retrySimilarQuestion: {
            label: 'Retry Similar Question',
            params: {
              similarTo: String(question._id),
              excludeQuestionId: String(question._id),
              limit: 1,
            },
          },
          moveToHarderQuestion: {
            label: 'Move to Harder Question',
            disabled: question.difficulty === 'Hard',
            params: {
              harderThan: String(question._id),
              excludeQuestionId: String(question._id),
              limit: 1,
            },
          },
        },
      },
      adaptive: {
        topic: `${question.subject} - ${question.topic}`,
        subtopic,
        concept: conceptTested,
        previousDifficulty: adaptiveDifficultyBefore,
        nextDifficulty: adaptiveDifficultyAfter,
        currentStoredDifficulty: topicEntry?.currentDifficulty || adaptiveDifficultyAfter,
      },
      performanceSnapshot: {
        avgAccuracy: performance?.overallAccuracy || 0,
        avgTimeTakenSec: performance?.averageTimeTakenSec || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getMyMistakeBank = async (req, res, next) => {
  try {
    const mistakeBank = await getMistakeBankForUser(req.user._id);
    return res.json(mistakeBank);
  } catch (error) {
    return next(error);
  }
};

const getMyAttempts = async (req, res, next) => {
  try {
    const attempts = await Attempt.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('question', 'text options difficulty subject topic');

    return res.json({ count: attempts.length, attempts });
  } catch (error) {
    return next(error);
  }
};

module.exports = { submitAttempt, getMyAttempts, getMyMistakeBank };
