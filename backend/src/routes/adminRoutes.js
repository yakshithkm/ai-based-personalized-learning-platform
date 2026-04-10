const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
	getQuestionStats,
	getExamSubjects,
} = require('../controllers/analyticsController');

const router = express.Router();

router.get('/question-stats', protect, getQuestionStats);
router.get('/exam-subjects', protect, getExamSubjects);

module.exports = router;
