const express = require('express');
const { submitAttempt, getMyAttempts, getMyMistakeBank } = require('../controllers/attemptController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, submitAttempt);
router.get('/me', protect, getMyAttempts);
router.get('/mistake-bank', protect, getMyMistakeBank);

module.exports = router;
