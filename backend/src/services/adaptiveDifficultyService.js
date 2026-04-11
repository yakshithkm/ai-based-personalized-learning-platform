const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const difficultyRank = (difficulty) => {
  const index = DIFFICULTIES.indexOf(difficulty);
  return index === -1 ? 1 : index;
};

const rankToDifficulty = (rank) => DIFFICULTIES[Math.min(Math.max(rank, 0), 2)];

const isFastAnswer = (timeTakenSec) => Number(timeTakenSec) <= 40;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const computeDifficultyScore = ({
  topicAccuracy,
  timeTakenSec,
  expectedTimeSec,
  recentStreak,
  mistakeFrequency,
}) => {
  const accuracyScore = clamp(Number(topicAccuracy || 0), 0, 100);

  const expected = Math.max(Number(expectedTimeSec || 60), 15);
  const actual = Math.max(Number(timeTakenSec || expected), 1);
  const timeRatio = expected / actual;
  const timeScore = clamp(timeRatio * 100, 0, 100);

  const streakScore = clamp(50 + Number(recentStreak || 0) * 10, 0, 100);
  const mistakePenaltyScore = clamp(100 - Number(mistakeFrequency || 0) * 12, 0, 100);

  return clamp(
    accuracyScore * 0.45 +
      timeScore * 0.25 +
      streakScore * 0.15 +
      mistakePenaltyScore * 0.15,
    0,
    100
  );
};

const evaluateAdaptiveDifficulty = ({
  currentDifficulty,
  topicAccuracy,
  isCorrect,
  timeTakenSec,
  expectedTimeSec = 60,
  recentStreak = 0,
  mistakeFrequency = 0,
}) => {
  const currentRank = difficultyRank(currentDifficulty || 'Medium');

  const score = computeDifficultyScore({
    topicAccuracy,
    timeTakenSec,
    expectedTimeSec,
    recentStreak,
    mistakeFrequency,
  });

  // Prevent random jumps: max one step adjustment per attempt.
  if (!isCorrect) {
    if (score < 45) return rankToDifficulty(currentRank - 1);
    return rankToDifficulty(currentRank);
  }

  if (score >= 72) {
    return rankToDifficulty(currentRank + 1);
  }

  if (score <= 40) {
    return rankToDifficulty(currentRank - 1);
  }

  return rankToDifficulty(currentRank);
};

const inferTopicDifficultyFromAttempts = (attempts = []) => {
  if (!attempts.length) return 'Medium';

  const oldestToNewest = [...attempts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let current = 'Medium';
  oldestToNewest.forEach((attempt) => {
    current = evaluateAdaptiveDifficulty({
      currentDifficulty: current,
      isCorrect: Boolean(attempt.isCorrect),
      timeTakenSec: Number(attempt.timeTakenSec || 0),
      expectedTimeSec: Number(attempt.expectedSolvingTimeSec || 60),
    });
  });

  return current;
};

module.exports = {
  evaluateAdaptiveDifficulty,
  inferTopicDifficultyFromAttempts,
  isFastAnswer,
  computeDifficultyScore,
};
