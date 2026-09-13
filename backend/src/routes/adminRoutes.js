const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectIdParam');
const {
	getQuestionStats,
	getExamSubjects,
} = require('../controllers/analyticsController');
const { adminLogin, getAdminProfile } = require('../controllers/adminAuthController');
const { getDashboardStats } = require('../controllers/adminDashboardController');
const { listStudents, getStudentDetail } = require('../controllers/adminStudentController');
const {
	listQuestions,
	getQuestion,
	createQuestion,
	updateQuestion,
	deleteQuestion,
} = require('../controllers/adminQuestionController');
const {
	listSubjects,
	listTopics,
	createTopic,
	updateTopic,
	deleteTopic,
} = require('../controllers/adminCatalogController');
const { listExamSessions, getExamSessionDetail } = require('../controllers/adminExamController');
const { getPlatformAnalytics } = require('../controllers/adminAnalyticsController');

const router = express.Router();
const validateId = validateObjectIdParam('id');

// --- Auth (public - this endpoint issues the token everything else requires) ---
router.post('/login', adminLogin);
router.get('/me', protect, requireAdmin, getAdminProfile);

// Everything below requires a valid admin session.
router.use(protect, requireAdmin);

// --- Dashboard ---
router.get('/dashboard', getDashboardStats);

// --- Students ---
router.get('/students', listStudents);
router.get('/students/:id', validateId, getStudentDetail);

// --- Question bank ---
router.get('/questions', listQuestions);
router.get('/questions/:id', validateId, getQuestion);
router.post('/questions', createQuestion);
router.put('/questions/:id', validateId, updateQuestion);
router.delete('/questions/:id', validateId, deleteQuestion);

// --- Subjects (read-only overview - see adminCatalogController.js) ---
router.get('/subjects', listSubjects);

// --- Topics (real CRUD via TopicMeta catalog) ---
router.get('/topics', listTopics);
router.post('/topics', createTopic);
router.put('/topics/:id', validateId, updateTopic);
router.delete('/topics/:id', validateId, deleteTopic);

// --- Exams (read-only session monitoring - see adminExamController.js) ---
router.get('/exams', listExamSessions);
router.get('/exams/:id', validateId, getExamSessionDetail);

// --- Analytics ---
router.get('/analytics', getPlatformAnalytics);

// --- Pre-existing endpoints (kept as-is) ---
router.get('/question-stats', getQuestionStats);
router.get('/exam-subjects', getExamSubjects);

module.exports = router;