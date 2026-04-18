const {
  createExamSession,
  getExamSessionState,
  getLatestActiveExamSessionState,
  submitAnswer,
  submitExamSession,
} = require('../services/examSimulationService');

const isTestOrDevMode = () => ['test', 'development'].includes(process.env.NODE_ENV);

const maybeApplyTestDelay = async (req) => {
  const testDelayMs = Number(req.query?.testDelay);
  if (!isTestOrDevMode() || !Number.isFinite(testDelayMs) || testDelayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, testDelayMs));
};

const startExamSession = async (req, res, next) => {
  try {
    const { mode = 'full-length', examType, sectionSubject, strictNavigation = false } = req.body || {};

    const session = await createExamSession({
      user: req.user,
      mode,
      examType,
      sectionSubject,
      strictNavigation,
    });

    return res.status(201).json(session);
  } catch (error) {
    res.status(error.statusCode || 400);
    return next(error);
  }
};

const getSessionState = async (req, res, next) => {
  try {
    const data = await getExamSessionState({
      userId: req.user._id,
      sessionId: req.params.sessionId,
    });

    return res.json(data);
  } catch (error) {
    res.status(error.statusCode || 400);
    return next(error);
  }
};

const getLatestActiveSessionState = async (req, res, next) => {
  try {
    const data = await getLatestActiveExamSessionState({
      userId: req.user._id,
    });

    return res.json({
      session: data,
    });
  } catch (error) {
    res.status(error.statusCode || 400);
    return next(error);
  }
};

const submitSessionAnswer = async (req, res, next) => {
  try {
    await maybeApplyTestDelay(req);

    const {
      questionIndex,
      questionId,
      selectedAnswerIndex,
      timeTakenSec,
      intentId,
      intentSeq,
      retryAttempt,
      sessionToken: bodySessionToken,
      requestNonce: bodyRequestNonce,
    } = req.body || {};

    const sessionToken = req.headers['x-exam-session-token'] || bodySessionToken;
    const requestNonce = req.headers['x-exam-request-nonce'] || bodyRequestNonce;

    const data = await submitAnswer({
      userId: req.user._id,
      sessionId: req.params.sessionId,
      questionIndex,
      questionId,
      selectedAnswerIndex,
      timeTakenSec,
      intentId,
      intentSeq,
      retryAttempt,
      sessionToken,
      requestNonce,
    });

    return res.json(data);
  } catch (error) {
    res.status(error.statusCode || 400);
    return next(error);
  }
};

const finalizeExamSession = async (req, res, next) => {
  try {
    const result = await submitExamSession({
      userId: req.user._id,
      sessionId: req.params.sessionId,
    });

    return res.json(result);
  } catch (error) {
    res.status(error.statusCode || 400);
    return next(error);
  }
};

module.exports = {
  startExamSession,
  getSessionState,
  getLatestActiveSessionState,
  submitSessionAnswer,
  finalizeExamSession,
};
