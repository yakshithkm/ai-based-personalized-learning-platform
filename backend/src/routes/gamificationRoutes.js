const express = require('express');
const {
	getSummary,
	getProfile,
	getAchievements,
	getHistory,
} = require('../controllers/gamificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Read-only by design: there is deliberately no POST /add-xp or similar.
// XP/level/streak/achievement state can only change as a side effect of
// real learning events processed server-side via gamificationService.
router.get('/summary', protect, getSummary);
router.get('/profile', protect, getProfile);
router.get('/achievements', protect, getAchievements);
router.get('/history', protect, getHistory);

module.exports = router;