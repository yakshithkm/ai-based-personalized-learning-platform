const express = require('express');
const { registerUser, loginUser, getProfile, updatePreferences } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getProfile);
router.patch('/preferences', protect, updatePreferences);

module.exports = router;