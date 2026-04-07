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

const buildWhyGotWrong = ({ isCorrect, topic, commonMistakePattern, selectedAnswerText }) => {
  if (isCorrect) {
    return '';
  }

  if (commonMistakePattern) {
    return commonMistakePattern;
  }

  if (selectedAnswerText) {
    return `You selected "${selectedAnswerText}" for ${topic}. This usually happens when distractor options look conceptually similar.`;
  }

  return `This miss in ${topic} likely came from a concept confusion. Slow down and eliminate clearly wrong options before selecting.`;
};

module.exports = {
  buildImprovementTip,
  buildWhyGotWrong,
};
