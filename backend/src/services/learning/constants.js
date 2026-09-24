// Shared vocabulary + tunables for the learning-content recommendation engine.
// Kept dependency-free so both Mongoose models and pure ranking functions can import it.

const EXAM_TYPES = ['NEET', 'JEE', 'CET'];
const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const CONTENT_TYPES = [
  'video',
  'article',
  'notes',
  'concept',
  'example',
  'quiz',
  'practice',
  'revision',
  'formula-sheet',
];

// Where a resource sits on the learning progression:
// introduction -> explanation -> worked-example -> practice -> revision -> advanced
const LEARNING_STAGES = ['introduction', 'explanation', 'worked-example', 'practice', 'revision', 'advanced'];

const CONTENT_TYPE_STAGE = {
  concept: 'introduction',
  notes: 'explanation',
  article: 'explanation',
  video: 'explanation',
  example: 'worked-example',
  quiz: 'practice',
  practice: 'practice',
  revision: 'revision',
  'formula-sheet': 'revision',
};

const STAGE_LABELS = {
  introduction: 'concept introduction',
  explanation: 'concept explanation',
  'worked-example': 'worked example',
  practice: 'practice set',
  revision: 'revision sheet',
  advanced: 'advanced material',
};

// Machine-readable recommendation reasons. 'cold-start' is an addition to the requested
// list: it is what a student with zero attempts gets, and the existing question engine
// already uses that same code for its starter set.
const REASONS = [
  'weak-topic',
  'weak-concept',
  'mistake-recovery',
  'spaced-review',
  'prerequisite',
  'new-topic',
  'mastery-progression',
  'exam-preparation',
  'revision',
  'advanced-challenge',
  'stagnation-break',
  'fallback',
  'cold-start',
];

const PRIORITIES = ['high', 'medium', 'low'];
const LEVELS = ['new', 'low', 'developing', 'proficient', 'high'];
const PROGRESS_STATUSES = ['not-started', 'in-progress', 'completed', 'skipped'];
const RECOMMENDATION_STATUSES = ['active', 'started', 'completed', 'dismissed', 'expired'];
const DIFFICULTY_FEEDBACK = ['too-easy', 'just-right', 'too-difficult'];

// Positive components add up to exactly 100; penalties are subtracted; the result is
// clamped to 0-100. (feedback can be negative, i.e. -3..+3.)
const WEIGHTS = {
  need: 23,
  weakness: 14,
  mistake: 9,
  masteryGap: 9,
  difficultyFit: 9,
  progression: 8,
  prerequisite: 7,
  exam: 6,
  freshness: 4,
  quality: 4,
  recency: 4,
  feedback: 3,
};

const PENALTIES = {
  completed: 60,
  completedRevisitable: 10,
  skippedRecent: 20,
  skippedOld: 8,
  ignoredPerDay: 6,
  ignoredCap: 20,
  difficultyMismatch: 12,
  advancedTooEarly: 15,
  beginnerTooLate: 15,
  unmetPrerequisite: 20,
};

// Existing weak-topic rule in analysisService is accuracy < 60, so 60 is the "target".
const WEAK_ACCURACY_THRESHOLD = 60;
const MIN_ATTEMPTS_FULL_CONFIDENCE = 5;
// Below this many total attempts the bundle is flagged as 'baseline' (sparse data).
const BASELINE_ATTEMPTS_NEEDED = 10;

// Level -> learning path template. `stage` steps are content, `practice` steps come from
// the question bank (count / difficulty / optional PYQ + timed flags).
const PATH_TEMPLATES = {
  new: [
    { stage: 'introduction' },
    { stage: 'explanation' },
    { practice: { count: 5, difficulty: 'Easy' } },
  ],
  low: [
    { stage: 'introduction' },
    { stage: 'worked-example' },
    { practice: { count: 5, difficulty: 'Easy' } },
    { practice: { count: 5, difficulty: 'Medium' } },
  ],
  developing: [
    { stage: 'explanation' },
    { stage: 'worked-example' },
    { practice: { count: 5, difficulty: 'Medium' } },
  ],
  proficient: [
    { stage: 'worked-example' },
    { practice: { count: 5, difficulty: 'Medium' } },
    { practice: { count: 5, difficulty: null } },
  ],
  high: [
    { stage: 'advanced' },
    { practice: { count: 5, difficulty: 'Hard' } },
    { practice: { count: 5, difficulty: 'Hard', yearTag: 'Previous Year', timed: true } },
  ],
};

const DEFAULT_PRACTICE_COUNT = 5;
const RECOMMENDATION_REUSE_DAYS = 7;
const QUESTION_LOG_TTL_DAYS = 45;
const MIN_ATTEMPTS_FOR_EFFECTIVENESS = 3;

module.exports = {
  EXAM_TYPES,
  SUBJECTS,
  DIFFICULTIES,
  CONTENT_TYPES,
  LEARNING_STAGES,
  CONTENT_TYPE_STAGE,
  STAGE_LABELS,
  REASONS,
  PRIORITIES,
  LEVELS,
  PROGRESS_STATUSES,
  RECOMMENDATION_STATUSES,
  DIFFICULTY_FEEDBACK,
  WEIGHTS,
  PENALTIES,
  WEAK_ACCURACY_THRESHOLD,
  MIN_ATTEMPTS_FULL_CONFIDENCE,
  BASELINE_ATTEMPTS_NEEDED,
  PATH_TEMPLATES,
  DEFAULT_PRACTICE_COUNT,
  RECOMMENDATION_REUSE_DAYS,
  QUESTION_LOG_TTL_DAYS,
  MIN_ATTEMPTS_FOR_EFFECTIVENESS,
};