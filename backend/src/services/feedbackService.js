const buildImprovementTip = ({ isCorrect, timeTakenSec, topic, difficulty, selectedAnswerText }) => {
  if (isCorrect && Number(timeTakenSec) <= 40) {
    return `Excellent pace on ${topic}. Try one ${difficulty} level harder question to keep improving.`;
  }

  if (isCorrect) {
    return `Good accuracy in ${topic}. Work on speed by practicing 5 timed questions.`;
  }

  if (selectedAnswerText) {
    return `Review the concept behind "${selectedAnswerText}" in ${topic}, then solve 3 easier reinforcement questions.`;
  }

  return `Revisit core concepts in ${topic} and start with easier questions before moving up.`;
};

module.exports = {
  buildImprovementTip,
};
