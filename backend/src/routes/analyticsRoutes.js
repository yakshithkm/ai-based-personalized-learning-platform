const express = require('express');
const {
	getMyAnalytics,
	trackEvent,
	getAdminSummary,
} = require('../controllers/analyticsController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/me', protect, getMyAnalytics);
router.post('/events', protect, trackEvent);
router.get('/admin-summary', protect, requireAdmin, getAdminSummary);

module.exports = router;
