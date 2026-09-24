const { EXAM_SUBJECT_MAP } = require('../../config/examSubjectMap');

// Inverse of config/examSubjectMap.js: which exams include a subject.
const getAllowedExamsForSubject = (subject) =>
  Object.keys(EXAM_SUBJECT_MAP).filter((exam) => EXAM_SUBJECT_MAP[exam].includes(subject));

module.exports = { getAllowedExamsForSubject };