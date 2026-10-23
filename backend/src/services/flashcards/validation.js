const { HttpError } = require('../learning/errors');
const {
  DIFFICULTIES,
  CARD_STYLES,
  DECK_SOURCES,
  LIMITS,
} = require('../../config/flashcards');

/** Plain-text normaliser: strips control characters, unifies newlines, trims. Never HTML. */
const cleanText = (value) => {
  if (typeof value !== 'string') return '';
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Dedupe key: case, punctuation and spacing insensitive ("What is ATP?" == "what is atp").
const normalizeKey = (text) =>
  cleanText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Validates one card from a client. Returns { front, back } or throws a 400. */
const validateCard = (input, index = null) => {
  const where = index === null ? '' : ` (card ${index + 1})`;
  const front = cleanText(input?.front);
  const back = cleanText(input?.back);
  if (!front) throw new HttpError(400, `Card front is required${where}`);
  if (!back) throw new HttpError(400, `Card back is required${where}`);
  if (front.length > LIMITS.FRONT) {
    throw new HttpError(400, `Card front must be ${LIMITS.FRONT} characters or fewer${where}`);
  }
  if (back.length > LIMITS.BACK) {
    throw new HttpError(400, `Card back must be ${LIMITS.BACK} characters or fewer${where}`);
  }
  return { front, back };
};

/** Validates a list of cards (non-empty, bounded, no duplicate fronts). */
const validateCardList = (cards, { max = LIMITS.CARDS_PER_SAVE } = {}) => {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new HttpError(400, 'A deck needs at least one card');
  }
  if (cards.length > max) throw new HttpError(400, `A deck can be saved with at most ${max} cards at once`);
  const seen = new Set();
  return cards.map((card, index) => {
    const valid = validateCard(card, index);
    const key = normalizeKey(valid.front);
    if (seen.has(key)) throw new HttpError(400, `Duplicate card front (card ${index + 1})`);
    seen.add(key);
    return valid;
  });
};

const optionalEnum = (value, allowed, label) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new HttpError(400, `Invalid ${label}`);
  }
  return value;
};

const cleanBounded = (value, max, label, { required = false } = {}) => {
  const text = cleanText(value);
  if (required && !text) throw new HttpError(400, `${label} is required`);
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer`);
  return text;
};

/** Deck metadata for creation. */
const validateDeckInput = (body = {}) => ({
  title: cleanBounded(body.title, LIMITS.TITLE, 'Title', { required: true }),
  description: cleanBounded(body.description, LIMITS.DESCRIPTION, 'Description'),
  topic: cleanBounded(body.topic, LIMITS.TOPIC, 'Topic'),
  difficulty: optionalEnum(body.difficulty, DIFFICULTIES, 'difficulty'),
  cardStyle: optionalEnum(body.cardStyle, CARD_STYLES, 'card style'),
  source: body.source ? optionalEnum(body.source, DECK_SOURCES, 'source') || 'manual' : 'manual',
});

/** Partial deck update (rename / describe / retopic). Only provided keys are returned. */
const validateDeckPatch = (body = {}) => {
  const patch = {};
  if (body.title !== undefined) patch.title = cleanBounded(body.title, LIMITS.TITLE, 'Title', { required: true });
  if (body.description !== undefined) patch.description = cleanBounded(body.description, LIMITS.DESCRIPTION, 'Description');
  if (body.topic !== undefined) patch.topic = cleanBounded(body.topic, LIMITS.TOPIC, 'Topic');
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update');
  return patch;
};

/** AI generation request. */
const validateGenerateInput = (body = {}) => {
  const topic = cleanBounded(body.topic, LIMITS.TOPIC, 'Topic');
  const sourceText = cleanBounded(body.sourceText, LIMITS.SOURCE_TEXT, 'Source material');
  const learningContentId = typeof body.learningContentId === 'string' ? body.learningContentId : '';
  if (!topic && !sourceText && !learningContentId) {
    throw new HttpError(400, 'Enter a topic or paste some source material');
  }
  const rawCount = body.count === undefined || body.count === null || body.count === '' ? 10 : Number(body.count);
  if (!Number.isInteger(rawCount) || rawCount < LIMITS.AI_MIN_CARDS || rawCount > LIMITS.AI_MAX_CARDS) {
    throw new HttpError(400, `Number of cards must be between ${LIMITS.AI_MIN_CARDS} and ${LIMITS.AI_MAX_CARDS}`);
  }
  const difficulty = optionalEnum(body.difficulty, DIFFICULTIES, 'difficulty') || 'intermediate';
  const cardStyle = optionalEnum(body.cardStyle, CARD_STYLES, 'card style') || 'qa';
  const avoidFronts = Array.isArray(body.avoidFronts)
    ? body.avoidFronts
        .filter((item) => typeof item === 'string')
        .map((item) => cleanText(item).slice(0, LIMITS.FRONT))
        .filter(Boolean)
        .slice(0, LIMITS.AI_AVOID_FRONTS)
    : [];
  return { topic, sourceText, learningContentId, count: rawCount, difficulty, cardStyle, avoidFronts };
};

class GeneratedOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeneratedOutputError';
    this.statusCode = 502;
  }
}

// Tolerates ```json fences and stray prose around the JSON a model returns.
const extractJson = (raw) => {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(text);
  } catch (error) {
    const start = text.search(/[[{]/);
    const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (innerError) {
      return null;
    }
  }
};

/**
 * Validates model output before anything is shown or saved: must parse, must contain cards with
 * non-empty front/back inside the length caps; duplicates (also against `avoidFronts`) and
 * over-count extras are dropped. Throws GeneratedOutputError when nothing usable remains.
 */
const parseGeneratedCards = (raw, { maxCards = LIMITS.AI_MAX_CARDS, avoidFronts = [] } = {}) => {
  const parsed = extractJson(raw);
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cards) ? parsed.cards : null;
  if (!list) throw new GeneratedOutputError('The AI returned an unreadable response. Please try again.');

  const seen = new Set(avoidFronts.map(normalizeKey));
  const cards = [];
  let dropped = 0;
  for (const item of list) {
    const front = cleanText(item?.front);
    const back = cleanText(item?.back);
    const key = normalizeKey(front);
    if (!front || !back || front.length > LIMITS.FRONT || back.length > LIMITS.BACK || !key || seen.has(key)) {
      dropped += 1;
      continue;
    }
    if (cards.length >= maxCards) {
      dropped += 1;
      continue;
    }
    seen.add(key);
    cards.push({ front, back });
  }
  if (cards.length === 0) {
    throw new GeneratedOutputError('The AI did not return any usable flashcards. Please try again or adjust your input.');
  }
  return { cards, dropped };
};

module.exports = {
  cleanText,
  normalizeKey,
  validateCard,
  validateCardList,
  validateDeckInput,
  validateDeckPatch,
  validateGenerateInput,
  parseGeneratedCards,
  extractJson,
  GeneratedOutputError,
};
