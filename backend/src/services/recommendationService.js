const Question = require('../models/Question');

const fallbackRecommendations = async (user, attempts) => {
  const topicStats = new Map();

  attempts.forEach((attempt) => {
    const key = `${attempt.subject}::${attempt.topic}`;
    if (!topicStats.has(key)) {
      topicStats.set(key, {
        subject: attempt.subject,
        topic: attempt.topic,
        attempts: 0,
        correct: 0,
      });
    }

    const item = topicStats.get(key);
    item.attempts += 1;
    item.correct += attempt.isCorrect ? 1 : 0;
  });

  const weakTopicRows = Array.from(topicStats.values())
    .map((row) => ({
      ...row,
      accuracy: row.attempts ? (row.correct / row.attempts) * 100 : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  const weakTopics = weakTopicRows.map((row) => `${row.subject} - ${row.topic}`);

  let recommendations;
  if (weakTopicRows.length) {
    const filters = weakTopicRows.map((row) => ({ subject: row.subject, topic: row.topic }));
    recommendations = await Question.find({
      examType: user.targetExam,
      $or: filters,
    })
      .limit(10)
      .select('-correctAnswerIndex');
  } else {
    recommendations = await Question.find({ examType: user.targetExam })
      .limit(10)
      .select('-correctAnswerIndex');
  }

  return {
    source: 'fallback-rule-engine',
    weakTopics,
    recommendations,
    confidence: 0.5,
  };
};

module.exports = { fallbackRecommendations };
