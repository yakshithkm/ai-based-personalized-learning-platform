const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getMyReferralSummary } = require('../controllers/referralController');

const router = express.Router();

router.get('/me', protect, getMyReferralSummary);

module.exports = router;