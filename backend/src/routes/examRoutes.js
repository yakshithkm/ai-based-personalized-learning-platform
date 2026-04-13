const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  startExamSession,
  getSessionState,
  getLatestActiveSessionState,
  submitSessionAnswer,
  finalizeExamSession,
} = require('../controllers/examController');

const router = express.Router();

router.post('/sessions', protect, startExamSession);
router.get('/sessions/active/latest', protect, getLatestActiveSessionState);
router.get('/sessions/:sessionId', protect, getSessionState);
router.patch('/sessions/:sessionId/answer', protect, submitSessionAnswer);
router.post('/sessions/:sessionId/submit', protect, finalizeExamSession);

module.exports = router;
