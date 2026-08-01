const express = require('express');
const {
  getQuestions,
  getQuestionById,
  getSubjectsAndTopics,
} = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/subjects-topics', protect, getSubjectsAndTopics);
router.get('/', protect, getQuestions);
router.get('/:id', protect, getQuestionById);

module.exports = router;
