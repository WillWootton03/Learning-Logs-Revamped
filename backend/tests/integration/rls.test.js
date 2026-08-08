/**
 * Integration tests for PostgreSQL row-level security.
 *
 * RLS (see db/schema.sql) is the database-layer backstop that verifies the
 * current user owns every row they read or write. These tests prove it works
 * by querying the database directly under one user's context and asserting the
 * other user's rows are invisible:
 *   - a board created by user A is invisible to user B at the DB layer
 *   - a board's concepts are invisible to user B at the DB layer
 *   - with no context at all, RLS returns nothing (fail closed)
 *
 * The app's own ownership checks are exercised in the other suites; these
 * tests go around the app to prove the database itself enforces ownership.
 *
 * DB requirements: same as auth.test.js (dedicated test DB, wiped per test).
 */
const request = require('supertest');
const app = require('../../app');
const { pool } = require('../../db/pool');
const { truncateAll } = require('./helpers/db');
const { registerVerifiedUser } = require('./helpers/auth');

const USER_A = { email: 'alice@example.com', password: 'Password123!' };
const USER_B = { email: 'bob@example.com', password: 'Password123!' };

/** Register a verified user and return { agent, user }. */
async function registerUser(body) {
  const { agent, user } = await registerVerifiedUser(body);
  return { agent, user };
}

/** Create a board via the API and return its id. */
async function createBoard(agent) {
  const res = await agent.post('/boards').send({ name: 'RLS Board' });
  expect(res.status).toBe(201);
  return res.body.board_id;
}

beforeEach(async () => {
  await truncateAll();
});

describe('row-level security', () => {
  it("user A's board is invisible to user B at the database layer", async () => {
    const { agent: aliceAgent, user: alice } = await registerUser(USER_A);
    const { user: bob } = await registerUser(USER_B);
    const boardId = await createBoard(aliceAgent);

    // Alice sees her own board, even when querying the table directly.
    const asAlice = await pool.runWithContext({ userId: alice.user_id }, () =>
      pool.query('SELECT board_id FROM boards WHERE board_id = $1', [boardId])
    );
    expect(asAlice.rowCount).toBe(1);

    // Bob sees nothing — RLS filters the row out despite the exact id match.
    const asBob = await pool.runWithContext({ userId: bob.user_id }, () =>
      pool.query('SELECT board_id FROM boards WHERE board_id = $1', [boardId])
    );
    expect(asBob.rowCount).toBe(0);
  });

  it("user A's board resources are invisible to user B", async () => {
    const { agent: aliceAgent, user: alice } = await registerUser(USER_A);
    const { user: bob } = await registerUser(USER_B);
    const boardId = await createBoard(aliceAgent);

    // Seed a concept on A's board through the app.
    await aliceAgent
      .post(`/boards/${boardId}/concepts/import`)
      .send({ concepts: [{ prompt: 'Secret?', answer: 'yes', hint: null, tags: 'private' }] })
      .expect(201);

    const asAlice = await pool.runWithContext({ userId: alice.user_id }, () =>
      pool.query('SELECT concept_id FROM concepts WHERE board_id = $1', [boardId])
    );
    expect(asAlice.rowCount).toBe(1);

    // Bob knows the board id but the concept rows are filtered out for him.
    const asBob = await pool.runWithContext({ userId: bob.user_id }, () =>
      pool.query('SELECT concept_id FROM concepts WHERE board_id = $1', [boardId])
    );
    expect(asBob.rowCount).toBe(0);
  });

  it('returns nothing when no user context is set (fail closed)', async () => {
    const { agent } = await registerUser(USER_A);
    await createBoard(agent);

    // No context -> no policy matches -> zero rows, even though rows exist.
    const noContext = await pool.query('SELECT board_id FROM boards');
    expect(noContext.rowCount).toBe(0);
  });
});
