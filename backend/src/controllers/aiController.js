const Question = require('../models/Question');
const Attempt = require('../models/Attempt');
const isValidObjectId = require('../utils/isValidObjectId');
const { streamDoubtResolutionReply } = require('../services/ai/aiService');

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1000;
const GENERIC_STREAM_ERROR_MESSAGE = "Sorry, I couldn't generate an explanation right now. Please try again.";

/**
 * Streams the doubt-resolution reply to the browser as Server-Sent Events,
 * so the Practice Page can render it word-by-word instead of waiting for
 * the whole answer. Request validation (bad input, question not found,
 * question not yet attempted) still happens up front and returns a normal
 * JSON error response with the right status code, exactly as before -
 * only once validation passes do we commit to the SSE response, since at
 * that point we can no longer change the HTTP status code if something
 * goes wrong. Any failure from Gemini itself (missing config, rate limit,
 * network, upstream, even mid-stream) is instead delivered as an
 * `{type:"error"}` SSE event so the frontend has one consistent way to
 * handle it regardless of when it happens.
 */
const explainQuestion = async (req, res, next) => {
  try {
    const { questionId, message, history } = req.body;

    if (!questionId || !isValidObjectId(questionId)) {
      res.status(400);
      throw new Error('A valid questionId is required');
    }

    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    if (!trimmedMessage) {
      res.status(400);
      throw new Error('message is required');
    }
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      res.status(400);
      throw new Error(`message must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
    }

    const question = await Question.findById(questionId).select(
      'text options correctAnswerIndex explanation subject topic conceptTested commonMistake'
    );
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }

    // Server-side enforcement (not just a UI gate) of "Ask with AI is only
    // available after the question has been attempted": this also doubles
    // as the guarantee that the assistant can never be pointed at a
    // question the student hasn't reached yet, since we only proceed once
    // we can find their own attempt at this exact question. No future
    // question, and no question bank, is ever fetched or sent here.
    const attempt = await Attempt.findOne({ user: req.user._id, question: question._id })
      .sort({ createdAt: -1 })
      .select('selectedAnswerIndex isCorrect');

    if (!attempt) {
      res.status(403);
      throw new Error('This question has not been attempted yet');
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (entry) =>
              entry &&
              (entry.role === 'user' || entry.role === 'assistant') &&
              typeof entry.content === 'string' &&
              entry.content.trim().length > 0
          )
          .slice(-MAX_HISTORY_MESSAGES)
          .map((entry) => ({ role: entry.role, content: entry.content.slice(0, MAX_MESSAGE_LENGTH) }))
      : [];

    // Everything past this point is committed to the streaming response -
    // no more res.status()/JSON error branches below.
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Stop pulling from Gemini if the student's browser disconnects
    // (closed the sidebar mid-stream, navigated away) rather than
    // finishing generation into a connection nobody is reading anymore.
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    try {
      for await (const chunkText of streamDoubtResolutionReply({
        question: {
          text: question.text,
          options: question.options,
          correctAnswer: question.options?.[question.correctAnswerIndex],
          explanation: question.explanation,
          conceptTested: question.conceptTested,
          commonMistake: question.commonMistake,
        },
        userAnswer: question.options?.[attempt.selectedAnswerIndex],
        wasCorrect: attempt.isCorrect,
        history: safeHistory,
        userMessage: trimmedMessage,
        signal: abortController.signal,
      })) {
        sendEvent({ type: 'chunk', text: chunkText });
      }
      sendEvent({ type: 'done' });
    } catch (streamError) {
      // GeminiServiceError instances already carry a student-safe message
      // (see geminiService.js) - never leaked details like stack traces or
      // the API key reach this event.
      sendEvent({ type: 'error', message: streamError.message || GENERIC_STREAM_ERROR_MESSAGE });
    } finally {
      if (!res.writableEnded) res.end();
    }
  } catch (error) {
    if (res.headersSent) {
      // Shouldn't normally happen (stream errors are caught above and sent
      // as an SSE event instead), but never leave the connection hanging.
      if (!res.writableEnded) res.end();
      return;
    }
    if (error.statusCode) {
      res.status(error.statusCode);
    }
    return next(error);
  }
};

module.exports = { explainQuestion };