const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { requireFeature, checkUsageLimit } = require('../middleware/tierMiddleware');
const { FEATURES } = require('../config/tiers');
const { validateObjectIdParam } = require('../middleware/validateObjectIdParam');
const {
  startExamSession,
  getSessionState,
  getLatestActiveSessionState,
  submitSessionAnswer,
  finalizeExamSession,
  reportExamViolation,
} = require('../controllers/examController');
const { downloadExamReport, downloadExamCertificate } = require('../controllers/examReportController');

const router = express.Router();
const validateSessionId = validateObjectIdParam('sessionId');

// Starting a simulation consumes one of the monthly exam credits. A refused start (e.g. 409 an
// exam is already active, 400 invalid mode) is refunded automatically.
router.post('/sessions', protect, requireFeature(FEATURES.EXAM_SIMULATION), checkUsageLimit('EXAMS'), startExamSession);
router.get('/sessions/active/latest', protect, getLatestActiveSessionState);
router.get('/sessions/:sessionId', protect, validateSessionId, getSessionState);
router.patch('/sessions/:sessionId/answer', protect, validateSessionId, submitSessionAnswer);
router.post('/sessions/:sessionId/submit', protect, validateSessionId, finalizeExamSession);
router.post('/sessions/:sessionId/violations', protect, validateSessionId, reportExamViolation);
router.get('/sessions/:sessionId/report', protect, requireFeature(FEATURES.DETAILED_EXAM_REPORT), validateSessionId, downloadExamReport);
router.get('/sessions/:sessionId/certificate', protect, requireFeature(FEATURES.DETAILED_EXAM_REPORT), validateSessionId, downloadExamCertificate);

module.exports = router;