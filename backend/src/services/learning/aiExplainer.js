// OPTIONAL polish of a recommendation explanation. The recommendation itself, its score, its
// reason code and its data-derived explanation are all decided WITHOUT any LLM; this only
// rephrases the single top explanation, is off by default, has a hard timeout, and its output
// is discarded unless it keeps every number from the rule-based text and adds no links.

const isEnabled = () => process.env.LEARNING_AI_EXPLANATIONS === 'true' && Boolean(process.env.GEMINI_API_KEY);

const numbersIn = (text) => (String(text).match(/\d+(?:\.\d+)?/g) || []).map(String);

const SYSTEM_INSTRUCTION =
  'You rewrite one short study-recommendation explanation for a student preparing for NEET/JEE/CET. ' +
  'Keep it to at most two friendly sentences. Keep every number exactly as given. Do not add facts, ' +
  'links, promises or numbers. Plain text only - no markdown, no LaTeX.';

const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('../../config/languages');

const languageSuffix = (language) => {
  const meta = SUPPORTED_LANGUAGES[language];
  if (!meta || language === DEFAULT_LANGUAGE) return '';
  // Digits stay 0-9 on purpose: the guard below verifies every number from the rule-based
  // text is still present, and native-script digits would (correctly) fail that check.
  return ` Write the sentences in ${meta.name} (${meta.nativeName}), keeping subject names, formulas and technical terms in their standard form and all numbers as Western digits (0-9).`;
};

const polishExplanation = async (text, { timeoutMs = 3000, streamReply, language } = {}) => {
  if (!isEnabled() && !streamReply) return null;
  try {
    const stream = streamReply || require('../ai/geminiService').streamReply;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let out = '';
    try {
      for await (const chunk of stream({
        systemInstruction: SYSTEM_INSTRUCTION + languageSuffix(language),
        contents: [{ role: 'user', parts: [{ text: `Rewrite: ${text}` }] }],
        signal: controller.signal,
      })) {
        out += chunk;
        if (out.length > 600) break;
      }
    } finally {
      clearTimeout(timer);
    }

    out = out.trim();
    if (!out || out.length > 400 || /https?:\/\//i.test(out)) return null;
    const required = numbersIn(text);
    const present = new Set(numbersIn(out));
    if (!required.every((num) => present.has(num))) return null;
    return out;
  } catch (error) {
    return null; // AI unavailable / rate-limited / timed out: keep the rule-based text.
  }
};

module.exports = { polishExplanation, isEnabled };