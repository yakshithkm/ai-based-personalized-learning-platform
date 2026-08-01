const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'data', 'question-seeds');
const required = [
  'examType',
  'subject',
  'topic',
  'subtopic',
  'difficulty',
  'difficultyLevel',
  'yearTag',
  'weightage',
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

const normalizeDifficultyLevel = (question) => {
  if (question.difficultyLevel) return question.difficultyLevel;
  if (question.difficulty === 'Easy') return 'Easy';
  if (question.difficulty === 'Hard') return 'Tough';
  return 'Moderate';
};

const normalizeYearTag = (question) => question.yearTag || 'Mock';

const normalizeWeightage = (question) => question.weightage || 'Medium';

const isVagueExplanation = (text = '') => {
  const normalized = String(text).trim();
  if (normalized.length < 45) return true;
  const vaguePatterns = [
    /easy question/i,
    /just apply formula/i,
    /^explanation\s*:?\s*$/i,
    /^because it is correct/i,
  ];
  return vaguePatterns.some((pattern) => pattern.test(normalized));
};

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
  const difficultyLevelSet = [...new Set(data.map((question) => normalizeDifficultyLevel(question)))];
  const yearTagSet = [...new Set(data.map((question) => normalizeYearTag(question)))];
  const weightageSet = [...new Set(data.map((question) => normalizeWeightage(question)))];
  const difficultyBreakdown = data.reduce(
    (acc, question) => {
      acc[question.difficulty] = (acc[question.difficulty] || 0) + 1;
      return acc;
    },
    { Easy: 0, Medium: 0, Hard: 0 }
  );
  const difficultyLevelBreakdown = data.reduce(
    (acc, question) => {
      const key = normalizeDifficultyLevel(question);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { Easy: 0, Moderate: 0, Tough: 0 }
  );
  const yearTagBreakdown = data.reduce(
    (acc, question) => {
      const key = normalizeYearTag(question);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { 'Previous Year': 0, Mock: 0, Conceptual: 0 }
  );
  const weightageBreakdown = data.reduce(
    (acc, question) => {
      const key = normalizeWeightage(question);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { High: 0, Medium: 0, Low: 0 }
  );

  const duplicateTextKeys = new Set();
  const duplicateQuestions = [];
  data.forEach((question, index) => {
    const key = `${question.examType}::${question.subject}::${String(question.text || '').trim().toLowerCase()}`;
    if (duplicateTextKeys.has(key)) {
      duplicateQuestions.push(index);
      return;
    }
    duplicateTextKeys.add(key);
  });

  const vagueExplanations = data.filter((question) => isVagueExplanation(question.explanation));
  const badAnswer = data.filter(
    (question) => question.options?.[question.correctAnswerIndex] !== question.correctAnswer
  );
  const badTimeEstimate = data.filter(
    (question) => typeof question.solvingTimeEstimate !== 'number' || question.solvingTimeEstimate <= 0
  );

  console.log(
    `${file}: count=${data.length}, topics=${topicSet.length}, difficulties=${difficultySet.join(',')}, levels=${difficultyLevelSet.join(',')}, yearTags=${yearTagSet.join(',')}, weightage=${weightageSet.join(',')}, easy=${difficultyBreakdown.Easy}, medium=${difficultyBreakdown.Medium}, hard=${difficultyBreakdown.Hard}, levelEasy=${difficultyLevelBreakdown.Easy}, levelModerate=${difficultyLevelBreakdown.Moderate}, levelTough=${difficultyLevelBreakdown.Tough}, pyq=${yearTagBreakdown['Previous Year']}, mock=${yearTagBreakdown.Mock}, conceptual=${yearTagBreakdown.Conceptual}, highWt=${weightageBreakdown.High}, medWt=${weightageBreakdown.Medium}, lowWt=${weightageBreakdown.Low}, duplicates=${duplicateQuestions.length}, vagueExplanation=${vagueExplanations.length}, missing=${missing.length}, badAnswer=${badAnswer.length}, badTimeEstimate=${badTimeEstimate.length}`
  );

  if (
    data.length < 100 ||
    missing.length ||
    badAnswer.length ||
    badTimeEstimate.length ||
    duplicateQuestions.length ||
    vagueExplanations.length > 2 ||
    topicSet.length < 3 ||
    difficultySet.length < 3 ||
    difficultyLevelSet.length < 3 ||
    yearTagSet.length < 3 ||
    weightageSet.length < 3 ||
    difficultyBreakdown.Easy < 40 ||
    difficultyBreakdown.Medium < 40 ||
    difficultyBreakdown.Hard < 20 ||
    difficultyLevelBreakdown.Easy < 20 ||
    difficultyLevelBreakdown.Moderate < 35 ||
    difficultyLevelBreakdown.Tough < 20 ||
    yearTagBreakdown['Previous Year'] < 15 ||
    yearTagBreakdown.Conceptual < 15 ||
    weightageBreakdown.High < 15 ||
    weightageBreakdown.Low < 10
  ) {
    hasFailure = true;
  }
});

if (hasFailure) {
  process.exitCode = 1;
}
