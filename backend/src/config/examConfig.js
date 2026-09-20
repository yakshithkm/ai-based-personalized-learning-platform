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

// Browser-based proctoring. Two SEPARATE counters, each with its own limit and auto-submit:
//  * focus violations (tab/window/route-leave)            -> MAX_VIOLATIONS
//  * "no person in front of the camera" warnings          -> PRESENCE_LIMIT
// A camera that is merely unavailable (denied/unplugged) is a client-side warning only and is
// never recorded or counted.
const EXAM_PROCTORING = {
  maxViolations: 5,
  maxPresenceWarnings: 5,
  violationTypes: ['TAB_HIDDEN', 'WINDOW_BLUR', 'ROUTE_LEAVE'],
  presenceType: 'NO_PERSON',
  submitReasons: ['MANUAL', 'TIME_EXPIRED', 'MAX_VIOLATIONS', 'PRESENCE_LIMIT'],
};

module.exports = {
  EXAM_CONFIG,
  DEFAULT_EXAM_CONFIG,
  EXAM_PROCTORING,
  getExamConfig,
};
