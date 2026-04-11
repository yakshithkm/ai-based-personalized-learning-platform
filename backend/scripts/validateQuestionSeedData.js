const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'data', 'question-seeds');
const required = [
  'examType',
  'subject',
  'topic',
  'subtopic',
  'difficulty',
  'conceptTested',
  'commonMistake',
  'solvingTimeEstimate',
  'difficultyReason',
  'text',
  'options',
  'correctAnswer',
  'correctAnswerIndex',
  'explanation',
  'mistakeType',
];

const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json')).sort();
let hasFailure = false;

files.forEach((file) => {
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const missing = data.filter((question) =>
    required.some((field) => {
      const value = question[field];
      return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    })
  );
  const topicSet = [...new Set(data.map((question) => question.topic))];
  const difficultySet = [...new Set(data.map((question) => question.difficulty))];
  const difficultyBreakdown = data.reduce(
    (acc, question) => {
      acc[question.difficulty] = (acc[question.difficulty] || 0) + 1;
      return acc;
    },
    { Easy: 0, Medium: 0, Hard: 0 }
  );
  const badAnswer = data.filter(
    (question) => question.options?.[question.correctAnswerIndex] !== question.correctAnswer
  );
  const badTimeEstimate = data.filter(
    (question) => typeof question.solvingTimeEstimate !== 'number' || question.solvingTimeEstimate <= 0
  );

  console.log(
    `${file}: count=${data.length}, topics=${topicSet.length}, difficulties=${difficultySet.join(',')}, easy=${difficultyBreakdown.Easy}, medium=${difficultyBreakdown.Medium}, hard=${difficultyBreakdown.Hard}, missing=${missing.length}, badAnswer=${badAnswer.length}, badTimeEstimate=${badTimeEstimate.length}`
  );

  if (
    data.length < 100 ||
    missing.length ||
    badAnswer.length ||
    badTimeEstimate.length ||
    topicSet.length < 3 ||
    difficultySet.length < 3 ||
    difficultyBreakdown.Easy < 40 ||
    difficultyBreakdown.Medium < 40 ||
    difficultyBreakdown.Hard < 20
  ) {
    hasFailure = true;
  }
});

if (hasFailure) {
  process.exitCode = 1;
}
