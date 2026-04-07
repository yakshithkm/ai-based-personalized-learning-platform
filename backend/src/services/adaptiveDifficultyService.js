const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const difficultyRank = (difficulty) => {
  const index = DIFFICULTIES.indexOf(difficulty);
  return index === -1 ? 1 : index;
};

const rankToDifficulty = (rank) => DIFFICULTIES[Math.min(Math.max(rank, 0), 2)];

const isFastAnswer = (timeTakenSec) => Number(timeTakenSec) <= 40;

const evaluateAdaptiveDifficulty = ({ currentDifficulty, topicAccuracy, isCorrect, timeTakenSec }) => {
  const currentRank = difficultyRank(currentDifficulty || 'Medium');

  if (Number.isFinite(Number(topicAccuracy))) {
    const normalizedAccuracy = Number(topicAccuracy);
    if (normalizedAccuracy > 80) {
      return rankToDifficulty(currentRank + 1);
    }

    if (normalizedAccuracy < 50) {
      return rankToDifficulty(currentRank - 1);
    }

    return rankToDifficulty(currentRank);
  }

  if (!isCorrect) {
    return rankToDifficulty(currentRank - 1);
  }

  if (isFastAnswer(timeTakenSec)) {
    return rankToDifficulty(currentRank + 1);
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
    });
  });

  return current;
};

module.exports = {
  evaluateAdaptiveDifficulty,
  inferTopicDifficultyFromAttempts,
  isFastAnswer,
};
