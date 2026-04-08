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

const getPerformanceLabel = ({ topicAccuracy }) => {
  const acc = Number(topicAccuracy || 0);
  if (acc >= 80) return 'Strong';
  if (acc >= 50) return 'Improving';
  return 'Needs Attention';
};

const classifyMistake = ({ isCorrect, timeTakenSec, selectedAnswerText, repeatedMistakeCount }) => {
  if (isCorrect) return '';

  if (Number(timeTakenSec) <= 15) {
    return 'Guess';
  }

  if (repeatedMistakeCount >= 2) {
    return 'Concept error';
  }

  if (/\d/.test(selectedAnswerText || '')) {
    return 'Calculation mistake';
  }

  return 'Concept error';
};

const buildMotivationMessage = ({ isCorrect, topic, repeatedMistakeCount, performanceLabel }) => {
  if (isCorrect && performanceLabel !== 'Needs Attention') {
    return `You're consistently improving in ${topic}. Keep the momentum.`;
  }

  if (!isCorrect && repeatedMistakeCount >= 2) {
    return `You're repeating the same mistake in ${topic}. Slow down and compare concepts before selecting.`;
  }

  if (isCorrect) {
    return `Nice recovery in ${topic}. One more focused question can lock this concept in.`;
  }

  return `Stay with ${topic} for a few more guided questions and accuracy will climb.`;
};

module.exports = {
  buildImprovementTip,
  buildWhyGotWrong,
  getPerformanceLabel,
  classifyMistake,
  buildMotivationMessage,
};
