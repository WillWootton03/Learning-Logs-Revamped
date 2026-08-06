/**
 * Integration tests for the /users/me routes.
 *
 * The user API is strictly self-scoped: there are no /users/:id routes. Every
 * operation acts on the authenticated user derived from the access-token
 * cookie. These tests verify:
 *   - the password hash never leaks in responses
 *   - unauthenticated requests are rejected with 401
 *   - email/name updates work end-to-end
 *   - password changes live on PUT /users/me/password (verified against the
 *     current password, and the new password works for login afterwards)
 *   - deletion kills the account so the token stops working
 *
 * DB requirements: same as auth.test.js (dedicated test DB, wiped per test).
 */
const request = require('supertest');
const app = require('../../app');
const { truncateAll } = require('./helpers/db');
const { registerVerifiedUser } = require('./helpers/auth');

const VALID_USER = { email: 'ada@example.com', password: 'Password123!' };

/**
 * Pull the value of a named cookie out of a `set-cookie` header array.
 * @param {string[]|undefined} setCookie - res.headers['set-cookie'].
 * @param {string} name - Cookie name, e.g. 'access_token'.
 * @returns {string|null} The cookie value, or null if absent.
 */
function extractCookie(setCookie, name) {
  const header = (setCookie || []).find((c) => c.startsWith(`${name}=`));
  return header ? header.split(';')[0].split('=')[1] : null;
}

/**
 * Register a user, complete email verification, and return an agent that
 * carries the auth cookies. Agents are supertest's browser-equivalent: they
 * persist set-cookie headers, so the access token is sent automatically.
 * @param {object} [overrides] - Body overrides for register.
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function registerUser(overrides = {}) {
  const { agent } = await registerVerifiedUser({ ...VALID_USER, ...overrides });
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
  it('updates the email and marks the account unverified until re-verified', async () => {
    const agent = await registerUser();

    const res = await agent.put('/users/me').send({ email: 'new@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('new@example.com');
    // A new address must be confirmed before it can log in again.
    expect(res.body.email_verified).toBe(false);
  });

  it('updates the full name and returns it on GET /users/me', async () => {
    const agent = await registerUser();

    const res = await agent.put('/users/me').send({ name: 'Ada Lovelace' });

    expect(res.status).toBe(200);
    expect(res.body.full_name).toBe('Ada Lovelace');

    const me = await agent.get('/users/me');
    expect(me.body.full_name).toBe('Ada Lovelace');
  });

  it('rejects with 400 when nothing is provided', async () => {
    const agent = await registerUser();

    const res = await agent.put('/users/me').send({});
    expect(res.status).toBe(400);
  });

  it('rejects with 409 when changing to an email already in use', async () => {
    // First user takes 'other@example.com'; the second tries to steal it.
    await registerUser({ email: 'other@example.com', password: 'Password123!' });
    const agent = await registerUser();

    const res = await agent.put('/users/me').send({ email: 'other@example.com' });
    expect(res.status).toBe(409);
  });
});

describe('PUT /users/me/password', () => {
  it('updates the password when the current password is provided, and the new password works for login', async () => {
    const agent = await registerUser();
    await agent
      .put('/users/me/password')
      .send({ newPassword: 'NewPassword123!', currentPassword: VALID_USER.password })
      .expect(200);

    // The real bcrypt round-trip: new password authenticates...
    const login = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: 'NewPassword123!' });
    expect(login.status).toBe(200);

    // ...and the old password is dead.
    const oldLogin = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    expect(oldLogin.status).toBe(401);
  });

  it('rejects a password change without the current password', async () => {
    const agent = await registerUser();

    const res = await agent.put('/users/me/password').send({ newPassword: 'NewPassword123!' });
    expect(res.status).toBe(400);
  });

  it('rejects a password change when the current password is wrong', async () => {
    const agent = await registerUser();

    const res = await agent
      .put('/users/me/password')
      .send({ newPassword: 'NewPassword123!', currentPassword: 'wrong-current' });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .put('/users/me/password')
      .send({ newPassword: 'NewPassword123!', currentPassword: VALID_USER.password });
    expect(res.status).toBe(401);
  });

  it('revokes OTHER sessions signed in before the change (password versioning)', async () => {
    const { agent: firstDevice } = await registerVerifiedUser(VALID_USER);

    // A second device signs into the SAME account — its own cookie jar.
    const secondDevice = request.agent(app);
    const login = await secondDevice.post('/auth/login').send(VALID_USER).expect(200);
    const staleRefresh = extractCookie(login.headers['set-cookie'], 'refresh_token');

    // Confirm the second device is signed in before the change.
    expect(await secondDevice.get('/users/me').expect(200)).toBeDefined();

    // The first device changes the password.
    await firstDevice
      .put('/users/me/password')
      .send({ newPassword: 'NewPassword123!', currentPassword: VALID_USER.password })
      .expect(200);

    // The second device's OLD access token is now stale: 401 PASSWORD_CHANGED
    // and its cookies are cleared so the client falls back to login.
    const denied = await secondDevice.get('/users/me');
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('PASSWORD_CHANGED');
    const cookies = (denied.headers['set-cookie'] || []).join(';');
    expect(cookies).toContain('access_token=;');
    expect(cookies).toContain('refresh_token=;');

    // Its stale refresh token (minted before the change) can't mint a new
    // access token either — the refresh route rejects it with PASSWORD_CHANGED
    // and revokes the cookies.
    const refused = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refresh_token=${staleRefresh}`);
    expect(refused.status).toBe(401);
    expect(refused.body.code).toBe('PASSWORD_CHANGED');

    // The device that changed the password stays signed in (fresh cookies
    // were issued against the new version).
    expect(await firstDevice.get('/users/me').expect(200)).toBeDefined();
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
    await registerUser({ email: 'grace@example.com', password: 'Password123!' });

    // userA's token still points at userA's account, untouched by the second
    // registration.
    const me = await userA.get('/users/me');
    expect(me.body.email).toBe(VALID_USER.email);
  });
});
