/**
 * Integration tests for POST /boards/:boardId/concepts/import — the CSV bulk
 * import endpoint.
 *
 * The frontend parses CSV text into rows { prompt, answer, hint, tags } and
 * sends them here. The backend must:
 *   - reject an empty/malformed payload with 400
 *   - batch-create concepts and their tags in one transaction (a duplicated
 *     tag name across rows is created once and reused)
 *   - link tags to the right concepts (idempotently)
 *   - reject rows with a missing prompt/answer
 *   - never touch another user's board (ownership enforced in SQL)
 *
 * DB requirements: same as auth.test.js (dedicated test DB, wiped per test).
 */
const request = require('supertest');
const app = require('../../app');
const { truncateAll } = require('./helpers/db');
const { registerVerifiedUser } = require('./helpers/auth');

const VALID_USER = { email: 'ada@example.com', password: 'Password123!' };

/**
 * Register a verified user and return an agent that carries the auth cookies.
 * Agents are supertest's browser-equivalent: they persist set-cookie headers,
 * so the access token is sent automatically on subsequent requests.
 * @param {object} [overrides] - Body overrides for register.
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function registerUser(overrides = {}) {
  const { agent } = await registerVerifiedUser({ ...VALID_USER, ...overrides });
  return agent;
}

/** Create a board for the given agent and return its id. */
async function createBoard(agent, name = 'Import Board') {
  const res = await agent.post('/boards').send({ name });
  expect(res.status).toBe(201);
  return res.body.board_id;
}

beforeEach(async () => {
  await truncateAll();
});

describe('POST /boards/:boardId/concepts/import', () => {
  it('bulk-creates concepts, tags, and links them in one call', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);

    // Tags come through as comma-separated strings ("theory" on two rows and
    // "algorithms" on one) — the service must split them into arrays and create
    // each tag once, reusing it across concepts.
    const res = await agent.post(`/boards/${boardId}/concepts/import`).send({
      concepts: [
        {
          prompt: 'What is a closure?',
          answer: 'A function that captures its lexical scope.',
          hint: 'Think function + environment',
          tags: 'javascript,theory',
        },
        {
          prompt: 'What is Big-O?',
          answer: 'Describes how runtime grows with input.',
          hint: null,
          tags: 'algorithms,theory',
        },
        {
          prompt: 'What is a promise?',
          answer: 'An eventual completion value.',
          hint: '',
          tags: 'algorithms',
        },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.concepts).toHaveLength(3);

    // The board now has exactly 3 unique tags.
    const tags = await agent.get(`/boards/${boardId}/tags`).expect(200);
    const names = tags.body.tags.map((t) => t.name).sort();
    expect(names).toEqual(['algorithms', 'javascript', 'theory']);

    // Each concept's tags are linked back correctly.
    const list = await agent.get(`/boards/${boardId}/concepts`).expect(200);
    const byPrompt = new Map(list.body.concepts.map((c) => [c.prompt, c.tags]));
    expect(byPrompt.get('What is a closure?')).toEqual(['javascript', 'theory']);
    expect(byPrompt.get('What is Big-O?')).toEqual(['algorithms', 'theory']);
    expect(byPrompt.get('What is a promise?')).toEqual(['algorithms']);
  });

  it('splits comma-separated tag strings, trims, and de-duplicates', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);

    const res = await agent.post(`/boards/${boardId}/concepts/import`).send({
      concepts: [
        {
          prompt: 'Tag normalization?',
          answer: 'Yes.',
          hint: null,
          // Leading/trailing spaces, empty segments, and a duplicate.
          tags: '  hooks , react, ,hooks,',
        },
      ],
    });

    expect(res.status).toBe(201);
    const list = await agent.get(`/boards/${boardId}/concepts`).expect(200);
    expect(list.body.concepts[0].tags).toEqual(['hooks', 'react']);
  });

  it('rejects an empty concepts array with 400', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);

    const res = await agent.post(`/boards/${boardId}/concepts/import`).send({ concepts: [] });
    expect(res.status).toBe(400);
  });

  it('rejects a row missing its prompt with 400', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);

    const res = await agent.post(`/boards/${boardId}/concepts/import`).send({
      concepts: [{ prompt: '', answer: 'something' }],
    });
    expect(res.status).toBe(400);
  });

  it('rejects a row missing its answer with 400', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);

    const res = await agent.post(`/boards/${boardId}/concepts/import`).send({
      concepts: [{ prompt: 'Question?', answer: '' }],
    });
    expect(res.status).toBe(400);
  });

  it('rejects imports onto another user\'s board with 404', async () => {
    const owner = await registerUser();
    const boardId = await createBoard(owner);
    // A different user tries to import into the owner's board.
    const intruder = await registerUser({ email: 'mal@example.com', password: 'Password123!' });

    const res = await intruder.post(`/boards/${boardId}/concepts/import`).send({
      concepts: [{ prompt: 'Sneaky?', answer: 'no' }],
    });
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/boards/00000000-0000-0000-0000-000000000000/concepts/import')
      .send({ concepts: [{ prompt: 'x', answer: 'y' }] });
    expect(res.status).toBe(401);
  });
});
