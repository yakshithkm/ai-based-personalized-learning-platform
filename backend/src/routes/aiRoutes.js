const express = require('express');
const { explainQuestion } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');
const { requireFeature, checkUsageLimit } = require('../middleware/tierMiddleware');
const { FEATURES } = require('../config/tiers');

const router = express.Router();

// Order matters: authenticate -> feature access -> atomic AI quota -> handler (Gemini). The key
// stays server-side; the quota applies to every caller, UI or hand-made HTTP request alike.
router.post(
  '/explain',
  protect,
  requireFeature(FEATURES.AI_DOUBT_SOLVING),
  checkUsageLimit('AI'),
  explainQuestion
);

module.exports = router;