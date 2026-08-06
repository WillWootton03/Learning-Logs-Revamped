/**
 * Integration tests for the board-scoped "delete all" endpoints:
 *   DELETE /boards/:boardId/concepts
 *   DELETE /boards/:boardId/tags
 *   DELETE /boards/:boardId/logs
 *   DELETE /boards/:boardId/quizzes
 *
 * Each endpoint must:
 *   - delete every owned row for the resource (returning the count)
 *   - leave the board itself intact
 *   - never touch another user's board (ownership enforced in SQL)
 *   - require authentication
 *
 * Deleting all concepts/tags also exercises the FK cascades (concept_tags,
 * quiz_questions, quiz_settings_tags) — no orphan rows may survive.
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
 * @param {object} [overrides] - Body overrides for register.
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function registerUser(overrides = {}) {
  const { agent } = await registerVerifiedUser({ ...VALID_USER, ...overrides });
  return agent;
}

/** Create a board for the given agent and return its id. */
async function createBoard(agent, name = 'Delete All Board') {
  const res = await agent.post('/boards').send({ name });
  expect(res.status).toBe(201);
  return res.body.board_id;
}

/** Seed one board with concepts, tags, a log, and a quiz run. */
async function seedBoard(agent, boardId) {
  // Two concepts via the import endpoint (tags get created + linked for free).
  await agent.post(`/boards/${boardId}/concepts/import`).send({
    concepts: [
      { prompt: 'What is a closure?', answer: 'Function + scope.', hint: null, tags: 'javascript,theory' },
      { prompt: 'What is Big-O?', answer: 'Runtime growth.', hint: null, tags: 'algorithms,theory' },
    ],
  });

  await agent.post(`/boards/${boardId}/logs`).send({ title: 'Day 1', content: 'Studied closures.' });

  const concepts = (await agent.get(`/boards/${boardId}/concepts`).expect(200)).body.concepts;
  await agent.post(`/boards/${boardId}/quizzes`).send({
    style: 'true_false',
    timeElapsedMs: 30000,
    answers: concepts.map((c) => ({ conceptId: c.concept_id, response: true })),
  });
}

beforeEach(async () => {
  await truncateAll();
});

describe('DELETE /boards/:boardId/concepts', () => {
  it('deletes every concept and returns the count', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);
    await seedBoard(agent, boardId);

    const res = await agent.delete(`/boards/${boardId}/concepts`).expect(200);
    expect(res.body).toEqual({ deleted: 2 });

    const list = await agent.get(`/boards/${boardId}/concepts`).expect(200);
    expect(list.body.concepts).toEqual([]);
  });

  it('leaves the board itself intact', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);
    await seedBoard(agent, boardId);

    await agent.delete(`/boards/${boardId}/concepts`).expect(200);

    const boards = await agent.get('/boards').expect(200);
    expect(boards.body.boards).toHaveLength(1);
  });

  it('does not touch another user\'s concepts', async () => {
    const owner = await registerUser();
    const boardId = await createBoard(owner);
    await seedBoard(owner, boardId);

    const intruder = await registerUser({ email: 'mal@example.com', password: 'Password123!' });
    const res = await intruder.delete(`/boards/${boardId}/concepts`).expect(200);
    // The SQL join scopes the delete to the caller's own board, so nothing is
    // deleted and the owner's data is untouched.
    expect(res.body).toEqual({ deleted: 0 });

    const list = await owner.get(`/boards/${boardId}/concepts`).expect(200);
    expect(list.body.concepts).toHaveLength(2);
  });

  it('requires authentication', async () => {
    const res = await request(app).delete('/boards/00000000-0000-0000-0000-000000000000/concepts');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /boards/:boardId/tags', () => {
  it('deletes every tag and unlinks them from concepts', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);
    await seedBoard(agent, boardId);

    const res = await agent.delete(`/boards/${boardId}/tags`).expect(200);
    expect(res.body).toEqual({ deleted: 3 }); // javascript, theory, algorithms

    const tags = await agent.get(`/boards/${boardId}/tags`).expect(200);
    expect(tags.body.tags).toEqual([]);

    // Concepts survive but carry no tags.
    const list = await agent.get(`/boards/${boardId}/concepts`).expect(200);
    expect(list.body.concepts).toHaveLength(2);
    for (const concept of list.body.concepts) {
      expect(concept.tags).toEqual([]);
    }
  });

  it('requires authentication', async () => {
    const res = await request(app).delete('/boards/00000000-0000-0000-0000-000000000000/tags');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /boards/:boardId/logs', () => {
  it('deletes every log and returns the count', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);
    await seedBoard(agent, boardId);

    const res = await agent.delete(`/boards/${boardId}/logs`).expect(200);
    expect(res.body).toEqual({ deleted: 1 });

    const logs = await agent.get(`/boards/${boardId}/logs`).expect(200);
    expect(logs.body.logs).toEqual([]);
  });

  it('requires authentication', async () => {
    const res = await request(app).delete('/boards/00000000-0000-0000-0000-000000000000/logs');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /boards/:boardId/quizzes', () => {
  it('deletes every quiz run and returns the count', async () => {
    const agent = await registerUser();
    const boardId = await createBoard(agent);
    await seedBoard(agent, boardId);

    const res = await agent.delete(`/boards/${boardId}/quizzes`).expect(200);
    expect(res.body).toEqual({ deleted: 1 });

    const runs = await agent.get(`/boards/${boardId}/quizzes`).expect(200);
    expect(runs.body.runs).toEqual([]);
  });

  it('requires authentication', async () => {
    const res = await request(app).delete('/boards/00000000-0000-0000-0000-000000000000/quizzes');
    expect(res.status).toBe(401);
  });
});
