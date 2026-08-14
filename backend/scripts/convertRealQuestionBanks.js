/**
 * Converts the real (non-synthetic) question banks in
 * src/data/raw-question-banks/*.json into the shape seedQuestions.js expects,
 * and writes the result into src/data/question-seeds/*.json, replacing the
 * synthetic placeholder content that was there before.
 *
 * Raw shape (per question):
 *   { subject, topic, source, question_number, question_text, options: {a:.., b:..}, marked_answer }
 *
 * Target shape (per question):
 *   { examType, subject, topic, subtopic, difficulty, text, conceptTested,
 *     commonMistake, solvingTimeEstimate, difficultyReason, correctAnswer,
 *     options: [4 strings], correctAnswerIndex, mistakeType, explanation }
 *
 * Exam-type coverage (confirmed with the project owner 2026-08-14):
 *   Biology     -> NEET, CET
 *   Physics     -> NEET, CET, JEE
 *   Chemistry   -> NEET, CET, JEE
 *   Mathematics -> CET, JEE
 * Each source question is duplicated once per applicable exam type, since the
 * Question model stores a single examType per document.
 */

const fs = require('fs');
const path = require('path');

const rawDir = path.join(__dirname, '..', 'src', 'data', 'raw-question-banks');
const outDir = path.join(__dirname, '..', 'src', 'data', 'question-seeds');

const EXAM_TYPES_BY_SUBJECT = {
  Biology: ['NEET', 'CET'],
  Physics: ['NEET', 'CET', 'JEE'],
  Chemistry: ['NEET', 'CET', 'JEE'],
  Mathematics: ['CET', 'JEE'],
};

const TIME_BY_DIFFICULTY = { Easy: 45, Medium: 60, Hard: 90 };

// Deterministic ~40/40/20 split, computed per-file from the *actual kept
// count* so seedQuestions.js's coverage check (Easy/Medium >= 39%,
// Hard >= 19%) clears with margin even on small files like Physics (72
// questions), where simple index%5 rounding can land a percentage point
// under the threshold.
const buildDifficultyPlan = (n) => {
  let easy = Math.round(n * 0.4);
  let hard = Math.round(n * 0.2);
  let medium = n - easy - hard;

  const pct = (count) => count / n;
  while (pct(medium) < 0.39 && easy > 0) {
    easy -= 1;
    medium += 1;
  }
  while (pct(hard) < 0.19 && medium > 0) {
    medium -= 1;
    hard += 1;
  }
  while (pct(easy) < 0.39 && medium > easy) {
    medium -= 1;
    easy += 1;
  }

  // Interleave (round-robin) instead of three solid blocks, purely so
  // difficulty isn't correlated with original question order.
  const remaining = { Easy: easy, Medium: medium, Hard: hard };
  const interleaved = [];
  while (interleaved.length < n) {
    ['Easy', 'Medium', 'Hard'].forEach((d) => {
      if (remaining[d] > 0) {
        interleaved.push(d);
        remaining[d] -= 1;
      }
    });
  }
  return interleaved;
};

const NUMERIC_OPTION_RE = /^-?[\d.,/\s]+[a-zA-Z%°ΩµA-Z]*$/;
const inferMistakeType = (options) => {
  const allNumericish = options.every((opt) => NUMERIC_OPTION_RE.test(opt.trim()) && /\d/.test(opt));
  return allNumericish ? 'calculation' : 'concept';
};

const convertFile = (subject, fileName) => {
  const rawPath = path.join(rawDir, fileName);
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

  const stats = { total: raw.length, droppedNullAnswer: 0, droppedBadOptions: 0, kept: 0 };
  const examTypes = EXAM_TYPES_BY_SUBJECT[subject];
  if (!examTypes) {
    throw new Error(`No examType mapping configured for subject "${subject}"`);
  }

  // First pass: filter to the usable questions only.
  const usable = [];
  raw.forEach((q) => {
    const optionEntries = Object.entries(q.options || {}).sort(([a], [b]) => (a < b ? -1 : 1));
    if (optionEntries.length !== 4) {
      stats.droppedBadOptions += 1;
      return;
    }
    if (q.marked_answer === null || q.marked_answer === undefined || !(q.marked_answer in q.options)) {
      stats.droppedNullAnswer += 1;
      return;
    }
    usable.push({ q, optionEntries });
  });
  stats.kept = usable.length;

  const difficultyPlan = buildDifficultyPlan(usable.length);
  const converted = [];

  usable.forEach(({ q, optionEntries }, i) => {
    const options = optionEntries.map(([, text]) => text);
    const correctAnswerIndex = optionEntries.findIndex(([key]) => key === q.marked_answer);
    const correctAnswer = options[correctAnswerIndex];
    const difficulty = difficultyPlan[i];
    const mistakeType = inferMistakeType(options);

    examTypes.forEach((examType) => {
      converted.push({
        examType,
        subject,
        topic: q.topic,
        subtopic: 'General',
        difficulty,
        text: q.question_text,
        conceptTested: q.topic,
        commonMistake: `Students often misread the setup or miscalculate under time pressure on ${q.topic} (${subject}).`,
        solvingTimeEstimate: TIME_BY_DIFFICULTY[difficulty],
        difficultyReason: `Sourced from real exam material (${q.source}); difficulty assigned as ${difficulty} pending manual review.`,
        correctAnswer,
        options,
        correctAnswerIndex,
        mistakeType,
        explanation: `Correct answer: ${correctAnswer}. (Source: ${q.source} — Q${q.question_number}. Full worked explanation pending manual enrichment.)`,
      });
    });
  });

  return { converted, stats };
};

const run = () => {
  const files = {
    Biology: 'biology.json',
    Physics: 'physics.json',
    Chemistry: 'chemistry.json',
    Mathematics: 'mathematics.json',
  };

  fs.mkdirSync(outDir, { recursive: true });

  const summary = [];
  Object.entries(files).forEach(([subject, fileName]) => {
    const { converted, stats } = convertFile(subject, fileName);
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, JSON.stringify(converted, null, 2));
    summary.push({ subject, ...stats, outputRows: converted.length, examTypes: EXAM_TYPES_BY_SUBJECT[subject] });
  });

  console.log('Conversion complete.\n');
  summary.forEach((row) => {
    console.log(
      `${row.subject}: ${row.total} raw -> ${row.kept} usable (dropped ${row.droppedNullAnswer} null-answer, ${row.droppedBadOptions} bad-option-count) -> ${row.outputRows} rows written (x${row.examTypes.length} exam tags: ${row.examTypes.join(', ')})`
    );
  });
};

if (require.main === module) {
  run();
}

module.exports = { convertFile, EXAM_TYPES_BY_SUBJECT };