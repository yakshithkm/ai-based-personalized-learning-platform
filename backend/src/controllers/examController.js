const {
  createExamSession,
  getExamSessionState,
  submitAnswer,
  submitExamSession,
} = require('../services/examSimulationService');

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

const submitSessionAnswer = async (req, res, next) => {
  try {
    const { questionIndex, selectedAnswerIndex, timeTakenSec } = req.body || {};

    const data = await submitAnswer({
      userId: req.user._id,
      sessionId: req.params.sessionId,
      questionIndex,
      selectedAnswerIndex,
      timeTakenSec,
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
  submitSessionAnswer,
  finalizeExamSession,
};
