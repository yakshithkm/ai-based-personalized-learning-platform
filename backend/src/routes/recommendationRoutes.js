const express = require('express');
const { getRecommendations, getFocusSession } = require('../controllers/recommendationController');
const learning = require('../controllers/learningRecommendationController');
const { protect } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectIdParam');

const router = express.Router();
const validateId = validateObjectIdParam('id');

// Question recommendations (unchanged shape; `?include=learning` additionally returns the
// learning-content bundle under `learning`).
router.get('/me', protect, getRecommendations);
router.get('/focus-session', protect, getFocusSession);

// Learning-content recommendations. Fixed paths first so they are never read as an :id.
router.get('/learning', protect, learning.getLearning);
router.get('/learn-next', protect, learning.getLearnNext);
router.get('/weak-areas', protect, learning.getWeakAreas);
router.get('/mistake-recovery', protect, learning.getMistakeRecovery);
router.get('/challenges', protect, learning.getChallenges);
router.get('/daily-plan', protect, learning.getDailyPlan);

// Recommendation lifecycle: open / progress / complete / skip / feedback / practice.
router.get('/:id', protect, validateId, learning.getRecommendation);
router.get('/:id/practice', protect, validateId, learning.practiceForRecommendation);
router.post('/:id/start', protect, validateId, learning.startRecommendation);
router.post('/:id/progress', protect, validateId, learning.progressRecommendation);
router.post('/:id/complete', protect, validateId, learning.completeRecommendation);
router.post('/:id/skip', protect, validateId, learning.skipRecommendation);
router.post('/:id/feedback', protect, validateId, learning.feedbackRecommendation);

module.exports = router;