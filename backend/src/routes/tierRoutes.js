const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getMyTier, getPlans, createCheckout } = require('../controllers/tierController');

const router = express.Router();

router.get('/plans', getPlans); // public: marketing catalogue only, no user data
router.get('/me', protect, getMyTier);
router.post('/checkout', protect, createCheckout);

module.exports = router;
