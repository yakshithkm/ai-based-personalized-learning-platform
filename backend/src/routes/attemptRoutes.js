const express = require('express');
const { submitAttempt, getMyAttempts, getMyMistakeBank } = require('../controllers/attemptController');
const { protect } = require('../middleware/authMiddleware');
const { requireFeature, checkUsageLimit } = require('../middleware/tierMiddleware');
const { FEATURES } = require('../config/tiers');

const router = express.Router();

// Practice is metered: each submitted attempt consumes one unit of the daily practice quota
// (atomically, server-side). Rejected / failed submissions give the unit back.
router.post('/', protect, requireFeature(FEATURES.BASIC_PRACTICE), checkUsageLimit('PRACTICE'), submitAttempt);
router.get('/me', protect, getMyAttempts);
router.get('/mistake-bank', protect, requireFeature(FEATURES.MISTAKE_BANK), getMyMistakeBank);

module.exports = router;
