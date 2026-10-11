// AI doubt solving: the AI quota unit is refunded only when the student received nothing.
const mockStream = jest.fn();
jest.mock('../../src/models/Question', () => ({
  findById: () => ({ select: async () => ({ _id: 'q1', text: 't', options: ['a', 'b'], correctAnswerIndex: 0 }) }),
}));
jest.mock('../../src/models/Attempt', () => ({
  findOne: () => ({ sort: () => ({ select: async () => ({ selectedAnswerIndex: 1, isCorrect: false }) }) }),
}));
jest.mock('../../src/services/ai/aiService', () => ({ streamDoubtResolutionReply: (...a) => mockStream(...a) }));
const { explainQuestion } = require('../../src/controllers/aiController');

const OID = '64b64b64b64b64b64b64b64b';
const makeReqRes = () => {
  const req = {
    body: { questionId: OID, message: 'why?' },
    user: { _id: 'u1' },
    tierContext: { tier: 'FREE' },
    headers: {},
    on: () => {},
  };
  const res = {
    locals: {}, writableEnded: false, written: [],
    status() { return res; }, setHeader() {}, flushHeaders() {},
    write(chunk) { res.written.push(chunk); },
    end() { res.writableEnded = true; },
    on: () => {},
  };
  return { req, res };
};

beforeEach(() => jest.resetAllMocks());

test('a completed answer keeps its quota unit', async () => {
  const { req, res } = makeReqRes();
  mockStream.mockImplementation(async function* gen() { yield 'a'; yield 'b'; });
  await explainQuestion(req, res, jest.fn());
  expect(res.locals.refundUsage).toBeUndefined();
});

test('LOOPHOLE CLOSED: an answer that was partly streamed before an error is still charged', async () => {
  const { req, res } = makeReqRes();
  mockStream.mockImplementation(async function* gen() { yield 'partial'; throw new Error('aborted'); });
  await explainQuestion(req, res, jest.fn());
  expect(res.locals.refundUsage).toBeUndefined();
});

test('nothing delivered (e.g. Gemini not configured / failed up front) is refunded', async () => {
  const { req, res } = makeReqRes();
  mockStream.mockImplementation(async function* gen() { throw new Error('not configured'); });
  await explainQuestion(req, res, jest.fn());
  expect(res.locals.refundUsage).toBe(true);
});