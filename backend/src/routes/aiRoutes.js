const express = require('express');
const { explainQuestion } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/explain', protect, explainQuestion);

module.exports = router;