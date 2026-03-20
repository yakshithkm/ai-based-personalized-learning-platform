const express = require('express');
const { submitAttempt, getMyAttempts } = require('../controllers/attemptController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, submitAttempt);
router.get('/me', protect, getMyAttempts);

module.exports = router;
