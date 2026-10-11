const express = require('express');
const { getRecommendations, getFocusSession } = require('../controllers/recommendationController');
const learning = require('../controllers/learningRecommendationController');
const { protect } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectIdParam');
const { requireFeature, requireUsageAvailable } = require('../middleware/tierMiddleware');
const { requireRecommendationContentAccess } = require('../middleware/contentAccessMiddleware');
const { FEATURES } = require('../config/tiers');

const router = express.Router();
const validateId = validateObjectIdParam('id');

// Question recommendations (unchanged shape; `?include=learning` additionally returns the
// learning-content bundle under `learning`).
router.get('/me', protect, requireFeature(FEATURES.BASIC_RECOMMENDATIONS), getRecommendations);
router.get('/focus-session', protect, requireFeature(FEATURES.ADVANCED_PRACTICE), requireUsageAvailable('PRACTICE'), getFocusSession);

// Learning-content recommendations. Fixed paths first so they are never read as an :id.
router.get('/learning', protect, requireFeature(FEATURES.BASIC_RECOMMENDATIONS), learning.getLearning);
router.get('/learn-next', protect, requireFeature(FEATURES.BASIC_RECOMMENDATIONS), learning.getLearnNext);
router.get('/weak-areas', protect, requireFeature(FEATURES.BASIC_RECOMMENDATIONS), learning.getWeakAreas);
router.get('/mistake-recovery', protect, requireFeature(FEATURES.ADVANCED_RECOMMENDATIONS), learning.getMistakeRecovery);
router.get('/challenges', protect, requireFeature(FEATURES.ADAPTIVE_LEARNING_PATHS), learning.getChallenges);
router.get('/daily-plan', protect, requireFeature(FEATURES.BASIC_RECOMMENDATIONS), learning.getDailyPlan);

// Recommendation lifecycle: open / progress / complete / skip / feedback / practice.
router.get('/:id', protect, validateId, requireRecommendationContentAccess, learning.getRecommendation);
router.get('/:id/practice', protect, validateId, requireRecommendationContentAccess, requireUsageAvailable('PRACTICE'), learning.practiceForRecommendation);
router.post('/:id/start', protect, validateId, requireRecommendationContentAccess, learning.startRecommendation);
router.post('/:id/progress', protect, validateId, requireRecommendationContentAccess, learning.progressRecommendation);
router.post('/:id/complete', protect, validateId, requireRecommendationContentAccess, learning.completeRecommendation);
router.post('/:id/skip', protect, validateId, learning.skipRecommendation);
router.post('/:id/feedback', protect, validateId, learning.feedbackRecommendation);

module.exports = router;