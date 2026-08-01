const EXAM_CONFIG = {
  NEET: {
    totalCandidates: 2000000,
    pyqShareRange: { min: 0.4, max: 0.6 },
    topicSkewMaxShare: 0.55,
  },
  CET: {
    totalCandidates: 350000,
    pyqShareRange: { min: 0.2, max: 0.4 },
    topicSkewMaxShare: 0.5,
  },
  JEE: {
    totalCandidates: 1200000,
    pyqShareRange: { min: 0.25, max: 0.45 },
    topicSkewMaxShare: 0.5,
  },
};

const DEFAULT_EXAM_CONFIG = {
  totalCandidates: 500000,
  pyqShareRange: { min: 0.25, max: 0.45 },
  topicSkewMaxShare: 0.55,
};

const getExamConfig = (examType) => EXAM_CONFIG[examType] || DEFAULT_EXAM_CONFIG;

module.exports = {
  EXAM_CONFIG,
  DEFAULT_EXAM_CONFIG,
  getExamConfig,
};
