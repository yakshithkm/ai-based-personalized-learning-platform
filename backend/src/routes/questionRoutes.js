const express = require('express');
const {
  getQuestions,
  getQuestionById,
  getSubjectsAndTopics,
} = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');
const { requireUsageAvailable } = require('../middleware/tierMiddleware');

const router = express.Router();

router.get('/subjects-topics', protect, getSubjectsAndTopics);
// Once the daily practice quota is spent, new questions are no longer served either (peek only -
// fetching does not consume; submitting an attempt does).
router.get('/', protect, requireUsageAvailable('PRACTICE'), getQuestions);
router.get('/:id', protect, getQuestionById);

module.exports = router;
