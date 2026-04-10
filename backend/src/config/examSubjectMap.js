const EXAM_SUBJECT_MAP = {
  NEET: ['Physics', 'Chemistry', 'Biology'],
  CET: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  JEE: ['Physics', 'Chemistry', 'Mathematics'],
};

const SUBJECT_CANONICAL = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

const normalizeExamType = (examType) => {
  if (!examType) return null;
  const key = String(examType).trim().toUpperCase();
  return EXAM_SUBJECT_MAP[key] ? key : null;
};

const getAllowedSubjectsForExam = (examType) => {
  const normalized = normalizeExamType(examType);
  return normalized ? EXAM_SUBJECT_MAP[normalized] : SUBJECT_CANONICAL;
};

const normalizeSubjectName = (subject) => {
  if (!subject) return null;
  const cleaned = String(subject).trim().toLowerCase();
  const match = SUBJECT_CANONICAL.find((item) => item.toLowerCase() === cleaned);
  return match || null;
};

module.exports = {
  EXAM_SUBJECT_MAP,
  normalizeExamType,
  getAllowedSubjectsForExam,
  normalizeSubjectName,
};
