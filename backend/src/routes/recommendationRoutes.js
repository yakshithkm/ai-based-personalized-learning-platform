const express = require('express');
const { getRecommendations, getFocusSession } = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/me', protect, getRecommendations);
router.get('/focus-session', protect, getFocusSession);

module.exports = router;
