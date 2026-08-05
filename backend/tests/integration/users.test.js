/**
 * Integration tests for the /users/me routes.
 *
 * The user API is strictly self-scoped: there are no /users/:id routes. Every
 * operation acts on the authenticated user derived from the access-token
 * cookie. These tests verify:
 *   - the password hash never leaks in responses
 *   - unauthenticated requests are rejected with 401
 *   - email/password updates work end-to-end (and the new password works)
 *   - deletion kills the account so the token stops working
 *
 * DB requirements: same as auth.test.js (dedicated test DB, wiped per test).
 */
const request = require('supertest');
const app = require('../../app');
const { truncateAll } = require('./helpers/db');

const VALID_USER = { email: 'ada@example.com', password: 'password123' };

/**
 * Register a user and return an agent that carries the auth cookies. Agents
 * are supertest's browser-equivalent: they persist set-cookie headers, so the
 * access token is sent automatically on subsequent requests.
 * @param {object} [overrides] - Body overrides for register.
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function registerUser(overrides = {}) {
  const agent = request.agent(app);
  await agent.post('/auth/register').send({ ...VALID_USER, ...overrides }).expect(201);
  return agent;
}

beforeEach(async () => {
  await truncateAll();
});

describe('GET /users/me', () => {
  it('returns the authenticated user without the password hash', async () => {
    const agent = await registerUser();

    const res = await agent.get('/users/me');

    expect(res.status).toBe(200);
    expect(res.body.user_id).toBeDefined();
    expect(res.body.email).toBe(VALID_USER.email);
    // The most important assertion for this route: no credentials in the body.
    expect(res.body.password_hash).toBeUndefined();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PUT /users/me', () => {
  it('updates the email', async () => {
    const agent = await registerUser();

    const res = await agent.put('/users/me').send({ email: 'new@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('new@example.com');
  });

  it('updates the password, and the new password works for login', async () => {
    const agent = await registerUser();
    await agent.put('/users/me').send({ password: 'new-password-123' }).expect(200);

    // The real bcrypt round-trip: new password authenticates...
    const login = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: 'new-password-123' });
    expect(login.status).toBe(200);

    // ...and the old password is dead.
    const oldLogin = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    expect(oldLogin.status).toBe(401);
  });

  it('rejects with 400 when nothing is provided', async () => {
    const agent = await registerUser();

    const res = await agent.put('/users/me').send({});
    expect(res.status).toBe(400);
  });

  it('rejects with 409 when changing to an email already in use', async () => {
    // First user takes 'other@example.com'; the second tries to steal it.
    await registerUser({ email: 'other@example.com', password: 'password123' });
    const agent = await registerUser();

    const res = await agent.put('/users/me').send({ email: 'other@example.com' });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /users/me', () => {
  it('deletes the account and the token no longer works', async () => {
    const agent = await registerUser();

    const res = await agent.delete('/users/me');

    expect(res.status).toBe(200);
    expect(res.body.user_id).toBeDefined();

    // The user row is gone, so the authenticate middleware's id lookup for
    // /users/me resolves to 401.
    const me = await agent.get('/users/me');
    expect(me.status).toBe(401);
  });
});

describe('isolation between users', () => {
  it('a second user is fully separated from the first', async () => {
    const userA = await registerUser();
    await registerUser({ email: 'grace@example.com', password: 'password123' });

    // userA's token still points at userA's account, untouched by the second
    // registration.
    const me = await userA.get('/users/me');
    expect(me.body.email).toBe(VALID_USER.email);
  });
});
