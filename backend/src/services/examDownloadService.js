const ExamSession = require('../models/ExamSession');
const Question = require('../models/Question');
const { generateCertificateId } = require('../utils/generateCertificateId');

const buildHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Loads a submitted exam session for the "Download Report" / "Download Certificate"
 * feature, enforcing ownership and completion, and assembles the exact question-by-
 * question detail (original order, student answer, authoritative correct answer) that
 * the requesting user is allowed to see.
 *
 * This intentionally does NOT recompute score/percentile/rank/analysis - all of that is
 * read as-is from `session.resultSummary`, which is written once by
 * `examSimulationService.submitExamSession` and treated here as the single source of
 * truth. The only "duplicate" work is a per-question correct/incorrect/unanswered flag,
 * which the stored resultSummary does not carry at question granularity and which is a
 * pure comparison of already-authoritative values (no scoring rules involved).
 */
const loadExamSessionForDownload = async ({ userId, sessionId }) => {
  // Scoping the query to { _id, user } (rather than fetching by id and checking
  // ownership after) means a mismatched user gets the same "not found" response as a
  // nonexistent session - no information is leaked about whether the session id exists
  // at all.
  const session = await ExamSession.findOne({ _id: sessionId, user: userId });

  if (!session) {
    throw buildHttpError('Exam session not found', 404);
  }

  if (!session.resultSummary || !['submitted', 'expired'].includes(session.status)) {
    throw buildHttpError('This exam has not been submitted yet. Submit the exam before downloading a report or certificate.', 409);
  }

  if (!session.certificateId) {
    // Lazily backfill for sessions that were submitted before this field existed.
    // Deterministic generation means this never produces a different value later.
    session.certificateId = generateCertificateId({ sessionId: session._id, examType: session.examType });
    await ExamSession.updateOne(
      { _id: session._id, user: userId },
      { $set: { certificateId: session.certificateId } }
    );
  }

  const questionIds = session.questionOrder.map((entry) => entry.question);
  const questions = await Question.find({ _id: { $in: questionIds } })
    .select('text options correctAnswer correctAnswerIndex explanation subject topic conceptTested')
    .lean();
  const questionDocMap = new Map(questions.map((q) => [String(q._id), q]));

  const responseMap = new Map((session.responses || []).map((entry) => [entry.questionIndex, entry]));

  const questionDetails = session.questionOrder.map((snapshot, index) => {
    const response = responseMap.get(index);
    const questionDoc = questionDocMap.get(String(snapshot.question));
    const hasSelection = !!response && Number.isInteger(response.selectedAnswerIndex);
    const isMissingQuestion = !questionDoc;

    let outcome = 'unanswered';
    if (!isMissingQuestion && hasSelection) {
      outcome = response.selectedAnswerIndex === questionDoc.correctAnswerIndex ? 'correct' : 'incorrect';
    }

    return {
      questionNumber: index + 1,
      subject: snapshot.subject,
      topic: snapshot.topic,
      conceptTested: snapshot.conceptTested,
      text: isMissingQuestion ? 'This question is no longer available.' : questionDoc.text,
      options: isMissingQuestion ? [] : questionDoc.options,
      selectedAnswerIndex: hasSelection ? response.selectedAnswerIndex : null,
      correctAnswerIndex: isMissingQuestion ? null : questionDoc.correctAnswerIndex,
      correctAnswerText: isMissingQuestion ? null : questionDoc.options?.[questionDoc.correctAnswerIndex] ?? questionDoc.correctAnswer,
      selectedAnswerText:
        hasSelection && !isMissingQuestion ? questionDoc.options?.[response.selectedAnswerIndex] ?? null : null,
      timeTakenSec: response ? Number(response.timeTakenSec || 0) : 0,
      outcome,
    };
  });

  return {
    session,
    questionDetails,
  };
};

module.exports = { loadExamSessionForDownload };