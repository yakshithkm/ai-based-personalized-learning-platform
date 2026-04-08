const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'data', 'question-seeds');
const required = [
  'examType',
  'subject',
  'topic',
  'subtopic',
  'difficulty',
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
  const badAnswer = data.filter(
    (question) => question.options?.[question.correctAnswerIndex] !== question.correctAnswer
  );

  console.log(
    `${file}: count=${data.length}, topics=${topicSet.length}, difficulties=${difficultySet.join(',')}, missing=${missing.length}, badAnswer=${badAnswer.length}`
  );

  if (data.length < 50 || missing.length || badAnswer.length || topicSet.length < 3 || difficultySet.length < 3) {
    hasFailure = true;
  }
});

if (hasFailure) {
  process.exitCode = 1;
}
