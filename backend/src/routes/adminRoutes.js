const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getQuestionStats } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/question-stats', protect, getQuestionStats);

module.exports = router;
