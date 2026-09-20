const express = require('express');
const { protect } = require('../middleware/authMiddleware');
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

router.post('/sessions', protect, startExamSession);
router.get('/sessions/active/latest', protect, getLatestActiveSessionState);
router.get('/sessions/:sessionId', protect, validateSessionId, getSessionState);
router.patch('/sessions/:sessionId/answer', protect, validateSessionId, submitSessionAnswer);
router.post('/sessions/:sessionId/submit', protect, validateSessionId, finalizeExamSession);
router.post('/sessions/:sessionId/violations', protect, validateSessionId, reportExamViolation);
router.get('/sessions/:sessionId/report', protect, validateSessionId, downloadExamReport);
router.get('/sessions/:sessionId/certificate', protect, validateSessionId, downloadExamCertificate);

module.exports = router;