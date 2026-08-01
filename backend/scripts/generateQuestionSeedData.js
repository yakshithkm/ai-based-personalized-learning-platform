const fs = require('fs');
const path = require('path');
const { EXAM_SUBJECT_MAP } = require('../src/config/examSubjectMap');

const outputDir = path.join(__dirname, '..', 'src', 'data', 'question-seeds');

const ensureDir = (dirPath) => fs.mkdirSync(dirPath, { recursive: true });

const difficultyForIndex = (index) => {
  if (index < 40) return 'Easy';
  if (index < 80) return 'Medium';
  return 'Hard';
};

const difficultyLevelForDifficulty = (difficulty) => {
  if (difficulty === 'Easy') return 'Easy';
  if (difficulty === 'Hard') return 'Tough';
  return 'Moderate';
};

const yearTagForIndex = (index) => {
  const mod = index % 10;
  if (mod < 4) return 'Previous Year';
  if (mod < 7) return 'Mock';
  return 'Conceptual';
};

const weightageForIndex = (index) => {
  const mod = index % 10;
  if (mod < 4) return 'High';
  if (mod < 8) return 'Medium';
  return 'Low';
};

const mistakeTypes = ['concept', 'calculation', 'trap'];

const examCycleBySubject = {
  Physics: ['JEE', 'CET', 'NEET', 'JEE', 'CET'],
  Chemistry: ['NEET', 'CET', 'JEE', 'CET', 'NEET'],
  Mathematics: ['JEE', 'CET', 'JEE', 'CET', 'JEE'],
  Biology: ['NEET', 'CET', 'NEET', 'CET', 'NEET'],
};

const topicMap = {
  Physics: [
    { topic: 'Kinematics', subtopics: ['Motion Equations', 'Graph Analysis'] },
    { topic: 'Dynamics', subtopics: ['Newton Laws', 'Friction'] },
    { topic: 'Current Electricity', subtopics: ['Ohm Law', 'Series Parallel'] },
    { topic: 'Thermodynamics', subtopics: ['First Law', 'Heat Transfer'] },
    { topic: 'Waves', subtopics: ['Wave Equation', 'Sound'] },
  ],
  Chemistry: [
    { topic: 'Mole Concept', subtopics: ['Mole-Mass', 'Avogadro'] },
    { topic: 'Atomic Structure', subtopics: ['Bohr Model', 'Quantum Numbers'] },
    { topic: 'Periodic Table', subtopics: ['Groups Trends', 'Periods Trends'] },
    { topic: 'Chemical Bonding', subtopics: ['Ionic Covalent', 'VSEPR'] },
    { topic: 'Equilibrium', subtopics: ['Kc Kp', 'Le Chatelier'] },
  ],
  Mathematics: [
    { topic: 'Algebra', subtopics: ['Linear Equations', 'Expressions'] },
    { topic: 'Quadratic Equations', subtopics: ['Roots', 'Discriminant'] },
    { topic: 'Probability', subtopics: ['Basic Probability', 'Events'] },
    { topic: 'Trigonometry', subtopics: ['Identities', 'Heights Distance'] },
    { topic: 'Calculus', subtopics: ['Differentiation', 'Integration'] },
  ],
  Biology: [
    { topic: 'Cell Biology', subtopics: ['Organelles', 'Membrane'] },
    { topic: 'Genetics', subtopics: ['Mendelian', 'Inheritance'] },
    { topic: 'Human Physiology', subtopics: ['Circulatory', 'Respiratory'] },
    { topic: 'Ecology', subtopics: ['Ecosystems', 'Food Chains'] },
    { topic: 'Plant Physiology', subtopics: ['Transport', 'Photosynthesis'] },
  ],
};

const buildQualityMeta = ({ topic, subtopic, difficulty, index }) => {
  const conceptTested = `${topic} - ${subtopic}`;
  const solvingTimeEstimate = difficulty === 'Easy' ? 45 : difficulty === 'Medium' ? 70 : 95;
  const commonMistake = difficulty === 'Hard'
    ? `Students skip the core condition in ${conceptTested} and jump to shortcuts too early.`
    : `Students confuse key definitions in ${conceptTested}, especially under time pressure.`;
  const difficultyReason = difficulty === 'Easy'
    ? `Direct formula/application question with one-step reasoning (seed item ${index + 1}).`
    : difficulty === 'Medium'
      ? `Requires multi-step reasoning and careful elimination (seed item ${index + 1}).`
      : `Combines concept interpretation with trap options and speed pressure (seed item ${index + 1}).`;

  return {
    conceptTested,
    commonMistake,
    solvingTimeEstimate,
    difficultyReason,
    explanation:
      `Step 1: Identify the core concept (${conceptTested}). ` +
      'Step 2: Apply the governing rule carefully. ' +
      'Step 3: Eliminate distractors by verifying unit/logic consistency. ' +
      'Step 4: Confirm final answer against the problem statement.',
  };
};

Object.keys(topicMap).forEach((subject) => {
  const requiredExams = Object.entries(EXAM_SUBJECT_MAP)
    .filter(([, subjects]) => subjects.includes(subject))
    .map(([exam]) => exam);

  const cycle = examCycleBySubject[subject] || [];
  requiredExams.forEach((exam) => {
    if (!cycle.includes(exam)) {
      throw new Error(`${subject} exam cycle must include ${exam}`);
    }
  });
});

const buildOptions = (base, correctOffset = 1) => {
  const values = [base - 1, base, base + 1, base + 2];
  return {
    options: values.map((value) => String(value)),
    correctAnswerIndex: correctOffset,
  };
};

const questionFactory = {
  Physics: ({ topic, subtopic, difficulty, difficultyLevel, yearTag, weightage, examType, index }) => {
    const a = (index % 7) + 2;
    const t = (index % 5) + 3;
    const result = a * t;
    const built = buildOptions(result, 1);
    return {
      examType,
      subject: 'Physics',
      topic,
      subtopic,
      difficulty,
      difficultyLevel,
      yearTag,
      weightage,
      ...buildQualityMeta({ topic, subtopic, difficulty, index }),
      text: `(${difficulty}) ${topic}/${subtopic}: If acceleration is ${a} m/s^2 for ${t} s from rest, final velocity is? [Q${index + 1}]`,
      options: built.options,
      correctAnswer: built.options[built.correctAnswerIndex],
      correctAnswerIndex: built.correctAnswerIndex,
      mistakeType: mistakeTypes[index % mistakeTypes.length],
    };
  },
  Chemistry: ({ topic, subtopic, difficulty, difficultyLevel, yearTag, weightage, examType, index }) => {
    const n = (index % 9) + 1;
    const molar = (index % 8) + 10;
    const result = n * molar;
    const built = buildOptions(result, 1);
    return {
      examType,
      subject: 'Chemistry',
      topic,
      subtopic,
      difficulty,
      difficultyLevel,
      yearTag,
      weightage,
      ...buildQualityMeta({ topic, subtopic, difficulty, index }),
      text: `(${difficulty}) ${topic}/${subtopic}: If ${n} mol has molar mass ${molar} g/mol, total mass is? [Q${index + 1}]`,
      options: built.options,
      correctAnswer: built.options[built.correctAnswerIndex],
      correctAnswerIndex: built.correctAnswerIndex,
      mistakeType: mistakeTypes[index % mistakeTypes.length],
    };
  },
  Mathematics: ({ topic, subtopic, difficulty, difficultyLevel, yearTag, weightage, examType, index }) => {
    const x = (index % 10) + 1;
    const value = x * x + 2;
    const built = buildOptions(value, 1);
    return {
      examType,
      subject: 'Mathematics',
      topic,
      subtopic,
      difficulty,
      difficultyLevel,
      yearTag,
      weightage,
      ...buildQualityMeta({ topic, subtopic, difficulty, index }),
      text: `(${difficulty}) ${topic}/${subtopic}: Evaluate x^2 + 2 for x = ${x}. [Q${index + 1}]`,
      options: built.options,
      correctAnswer: built.options[built.correctAnswerIndex],
      correctAnswerIndex: built.correctAnswerIndex,
      mistakeType: mistakeTypes[index % mistakeTypes.length],
    };
  },
  Biology: ({ topic, subtopic, difficulty, difficultyLevel, yearTag, weightage, examType, index }) => {
    const baseFacts = [
      'Mitochondria are linked to ATP production',
      'Genes are units of heredity',
      'Nephrons are kidney filtration units',
      'Producers form the first trophic level',
      'Xylem transports water in plants',
    ];
    const answer = baseFacts[index % baseFacts.length];
    const distractors = [
      'Ribosomes store DNA',
      'Lysosomes perform photosynthesis',
      'Veins carry food in plants',
    ];

    const options = [distractors[0], answer, distractors[1], distractors[2]];

    return {
      examType,
      subject: 'Biology',
      topic,
      subtopic,
      difficulty,
      difficultyLevel,
      yearTag,
      weightage,
      ...buildQualityMeta({ topic, subtopic, difficulty, index }),
      text: `(${difficulty}) ${topic}/${subtopic}: Select the correct biological statement. [Q${index + 1}]`,
      options,
      correctAnswer: answer,
      correctAnswerIndex: 1,
      mistakeType: mistakeTypes[index % mistakeTypes.length],
    };
  },
};

const generateSubjectQuestions = (subject, total = 100) => {
  const topics = topicMap[subject];
  const examCycle = examCycleBySubject[subject];
  const makeQuestion = questionFactory[subject];
  const questions = [];

  for (let index = 0; index < total; index += 1) {
    const topicEntry = topics[index % topics.length];
    const subtopic = topicEntry.subtopics[index % topicEntry.subtopics.length];
    const difficulty = difficultyForIndex(index);
    const difficultyLevel = difficultyLevelForDifficulty(difficulty);
    const yearTag = yearTagForIndex(index);
    const weightage = weightageForIndex(index);
    const examType = examCycle[index % examCycle.length];

    questions.push(
      makeQuestion({
        topic: topicEntry.topic,
        subtopic,
        difficulty,
        difficultyLevel,
        yearTag,
        weightage,
        examType,
        index,
      })
    );
  }

  return questions;
};

const summary = {};
ensureDir(outputDir);

['Mathematics', 'Physics', 'Chemistry', 'Biology'].forEach((subject) => {
  const questions = generateSubjectQuestions(subject, 100);
  const filePath = path.join(outputDir, `${subject.toLowerCase()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');

  const difficultyBreakdown = questions.reduce(
    (acc, question) => {
      acc[question.difficulty] += 1;
      return acc;
    },
    { Easy: 0, Medium: 0, Hard: 0 }
  );

  const examBreakdown = questions.reduce((acc, question) => {
    acc[question.examType] = (acc[question.examType] || 0) + 1;
    return acc;
  }, {});

  summary[subject] = {
    count: questions.length,
    topics: [...new Set(questions.map((question) => question.topic))].length,
    subtopics: [...new Set(questions.map((question) => `${question.topic}::${question.subtopic}`))].length,
    difficultyBreakdown,
    examBreakdown,
  };
});

console.log(JSON.stringify(summary, null, 2));
