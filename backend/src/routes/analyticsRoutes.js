const express = require('express');
const { getMyAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/me', protect, getMyAnalytics);

module.exports = router;
