const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const attemptRoutes = require('./routes/attemptRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const examRoutes = require('./routes/examRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const { protect } = require('./middleware/authMiddleware');
const { validateObjectIdParam } = require('./middleware/validateObjectIdParam');
const { getDebugIntents } = require('./controllers/examController');

const app = express();

app.use(helmet());
// Auth is Bearer-token based (Authorization header, see frontend/src/api/client.js) - no
// cookies are used, so `credentials: true` is unnecessary here and, combined with a
// wildcard origin fallback, was a CORS misconfiguration (open to any origin whenever
// CLIENT_URL isn't set, which most scanners flag even though browsers reject credentialed
// wildcard responses). CLIENT_URL may be a single origin or a comma-separated list.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());
app.use(morgan('dev'));

// Strips any request body/query/param keys starting with "$" or containing "." (e.g.
// { email: { $gt: "" } }) before they can reach a Mongoose query and be interpreted as
// a Mongo operator instead of a plain value - e.g. login's User.findOne({ email }) took
// `email` straight from the request body with no sanitization.
app.use(mongoSanitize());

// General throttle across the API. Exam routes are intentionally excluded - they already
// have their own purpose-built, per-session rate limiting integrated with the audit trail
// (see examSimulationService.js), which can legitimately allow more requests during heavy
// exam use than a coarse per-IP cap should. This covers everything that previously had no
// throttling at all - including login/register.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', apiLimiter);
app.use('/api/questions', apiLimiter);
app.use('/api/attempts', apiLimiter);
app.use('/api/analytics', apiLimiter);
app.use('/api/recommendations', apiLimiter);
app.use('/api/admin', apiLimiter);

// Login/register are brute-force/credential-stuffing/signup-spam targets, so they get a
// tighter limit on top of the general one.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin', adminRoutes);

app.get(
  '/api/exam/session/:sessionId/debug-intents',
  protect,
  validateObjectIdParam('sessionId'),
  getDebugIntents
);

app.use('/api/exams', examRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
