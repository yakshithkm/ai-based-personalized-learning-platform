const { GoogleGenAI } = require('@google/genai');

// The client is cheap to construct, but we only want to build it once per
// API key (and rebuild if the key is hot-reloaded in dev), rather than on
// every single request.
let cachedClient = null;
let cachedApiKey = null;

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }
  return cachedClient;
};

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Deliberately a Flash-Lite model, not the full Flash line: as of writing,
// gemini-3.5-flash/3.6-flash/3.7-flash/3.8-flash are capped at only ~20
// free requests/day, while the Flash-Lite variants (3.5/3.1 Flash-Lite) get
// ~500/day - 25x more headroom on the same $0 tier, which matters a lot
// during active development/testing. If you ever hit "quota exceeded" 429s
// consistently, check ai.google.dev/gemini-api/docs/rate-limits for the
// current numbers - Google adjusts these without much notice.

// A "thinking" model like this one spends part of maxOutputTokens on
// hidden internal reasoning before it writes the visible answer - that
// reasoning is NOT part of response.text, but it IS deducted from the same
// token budget. Left uncapped, it can consume most of a small budget and
// cut the visible answer off mid-sentence. thinkingLevel keeps that
// overhead low (this is grounded explanation from given facts, not a novel
// reasoning puzzle, so heavy thinking isn't needed) and maxOutputTokens is
// sized generously enough to leave real headroom for the visible answer
// even after some thinking - still trivial usage on the free tier.
const MAX_OUTPUT_TOKENS = 2048;
const THINKING_LEVEL = 'low';

const RATE_LIMIT_MESSAGE = 'AI usage limit reached temporarily. Please try again later.';
const CONFIG_MISSING_MESSAGE = 'AI explanation is temporarily unavailable.';
const NETWORK_ERROR_MESSAGE = 'Unable to connect to the AI service. Please try again.';
const UPSTREAM_ERROR_MESSAGE = "Sorry, I couldn't generate an explanation right now. Please try again.";

class GeminiServiceError extends Error {
  constructor(message, { code, statusCode }) {
    super(message);
    this.name = 'GeminiServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Shared by both the request-setup phase and the mid-stream iteration phase
// below, since a Gemini failure can happen at either point once we've
// switched to streaming.
const translateGeminiError = (error) => {
  if (error instanceof GeminiServiceError) return error;

  const status = error?.status;

  if (status === 429) {
    console.error('[gemini] rate limit hit (429 RESOURCE_EXHAUSTED):', error.message);
    return new GeminiServiceError(RATE_LIMIT_MESSAGE, { code: 'RATE_LIMITED', statusCode: 429 });
  }

  if (typeof status === 'number') {
    console.error('[gemini] upstream API error:', status, error.message);
    return new GeminiServiceError(UPSTREAM_ERROR_MESSAGE, { code: 'UPSTREAM_ERROR', statusCode: 502 });
  }

  // No HTTP status at all usually means the request never reached Google
  // (DNS/network failure) rather than Gemini itself returning an error.
  console.error('[gemini] request failed (network or unknown error):', error.message);
  return new GeminiServiceError(NETWORK_ERROR_MESSAGE, { code: 'NETWORK_ERROR', statusCode: 502 });
};

/**
 * Streams a Gemini reply as an async generator of plain-text chunks, for a
 * ChatGPT-style word-by-word UI instead of waiting for the whole answer.
 *
 * `contents` must already be in Gemini's role vocabulary ('user' / 'model'),
 * ending with the latest user turn - building that from our own chat state
 * is aiService's job, not this file's.
 *
 * Deliberately does not retry on failure (including 429), whether that
 * failure happens before the first chunk or partway through: the free-tier
 * protection requirement is to surface a rate-limit condition once, not to
 * hammer the API. The caller (aiController) is what decides whether/when
 * the student tries again, via an explicit new request.
 */
async function* streamReply({ systemInstruction, contents, signal }) {
  const client = getClient();
  if (!client) {
    // Safe to log in detail server-side; the student only ever sees the
    // generic CONFIG_MISSING_MESSAGE below, never "GEMINI_API_KEY missing".
    console.error('[gemini] AI tutor is not configured: GEMINI_API_KEY is missing.');
    throw new GeminiServiceError(CONFIG_MISSING_MESSAGE, { code: 'CONFIG_MISSING', statusCode: 503 });
  }

  let stream;
  try {
    stream = await client.models.generateContentStream({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // Flash-Lite models silently ignore a custom temperature/top-K/
        // top-P (not an error - the value is just dropped), so this has no
        // effect on the default model above; harmless to leave in for
        // anyone who points GEMINI_MODEL at a full Flash model instead.
        temperature: 0.4,
        // thinkingBudget (the older numeric knob) errors out on Gemini 3.5+
        // models, so thinkingLevel is the correct control for the 3.x
        // models this app targets going forward.
        thinkingConfig: { thinkingLevel: THINKING_LEVEL },
        // Lets the controller stop pulling from Gemini as soon as the
        // student's browser disconnects (navigated away, closed the
        // sidebar mid-stream) instead of finishing the generation into a
        // connection nobody is reading anymore.
        abortSignal: signal,
      },
    });
  } catch (error) {
    throw translateGeminiError(error);
  }

  let sawAnyText = false;

  try {
    for await (const chunk of stream) {
      const finishReason = chunk?.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        // The student still gets whatever text was generated before the
        // cutoff (better than nothing), but this is worth knowing about
        // server-side - if it shows up often, MAX_OUTPUT_TOKENS needs
        // raising further.
        console.warn('[gemini] response was cut off at MAX_TOKENS - consider raising MAX_OUTPUT_TOKENS.');
      }

      const text = chunk?.text;
      if (text) {
        sawAnyText = true;
        yield text;
      }
    }
  } catch (error) {
    // A failure here means some chunks may already have reached the
    // student - the controller decides how to fold that into the SSE
    // stream (see aiController.js), this layer just reports what happened.
    throw translateGeminiError(error);
  }

  if (!sawAnyText) {
    throw new GeminiServiceError(UPSTREAM_ERROR_MESSAGE, { code: 'EMPTY_RESPONSE', statusCode: 502 });
  }
}

module.exports = { streamReply, GeminiServiceError, MODEL };