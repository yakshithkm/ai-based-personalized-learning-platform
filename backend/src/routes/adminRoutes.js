const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const {
	getQuestionStats,
	getExamSubjects,
} = require('../controllers/analyticsController');

const router = express.Router();

router.get('/question-stats', protect, requireAdmin, getQuestionStats);
router.get('/exam-subjects', protect, requireAdmin, getExamSubjects);

module.exports = router;
