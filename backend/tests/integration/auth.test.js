/**
 * Integration tests for the /auth routes.
 *
 * Unlike the unit tests, these run the real Express app through supertest
 * against a real PostgreSQL database. They verify the full request lifecycle:
 * bcrypt hashing, JWT signing, httpOnly cookie handling, and the JSON error
 * middleware — the parts the unit tests deliberately stub out.
 *
 * DB requirements:
 *   - A dedicated test database (see jest.setup.js / globalSetup.js), so dev
 *     data is never touched.
 *   - beforeEach wipes all tables so every test starts clean.
 */
const request = require('supertest');
const app = require('../../app');
const { truncateAll } = require('./helpers/db');

const VALID_USER = { email: 'ada@example.com', password: 'password123' };

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

beforeEach(async () => {
  await truncateAll();
});

describe('POST /auth/register', () => {
  it('creates an account and sets httpOnly auth cookies', async () => {
    const res = await request(app).post('/auth/register').send(VALID_USER);

    // 201 = resource created.
    expect(res.status).toBe(201);
    expect(res.body.user_id).toBeDefined();

    // The tokens live in cookies (not the JSON body), and must be HttpOnly so
    // client-side JS can't read them (XSS protection).
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toContain('access_token=');
    expect(cookies).toContain('refresh_token=');
    expect(cookies).toContain('HttpOnly');
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/auth/register').send(VALID_USER).expect(201);

    // The UNIQUE constraint on users.email surfaces as a 409 conflict.
    const res = await request(app).post('/auth/register').send(VALID_USER);
    expect(res.status).toBe(409);
  });

  it('rejects a malformed email with 400', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing credentials with 400', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'ada@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  // Every login test needs a registered user first.
  beforeEach(async () => {
    await request(app).post('/auth/register').send(VALID_USER).expect(201);
  });

  it('logs in with correct credentials and sets cookies', async () => {
    const res = await request(app).post('/auth/login').send(VALID_USER);

    expect(res.status).toBe(200);
    expect(res.body.user_id).toBeDefined();
    expect(res.headers['set-cookie'].join(';')).toContain('access_token=');
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email with 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' });
    // Same 401 as a wrong password — the API must not reveal whether an email
    // is registered.
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('clears the auth cookies', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(204); // no body
    // Cookies come back with empty values (expired), so the browser drops them.
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toContain('access_token=;');
    expect(cookies).toContain('refresh_token=;');
  });
});

describe('POST /auth/refresh', () => {
  it('mints a fresh access token while keeping the refresh token static', async () => {
    // request.agent persists cookies across requests, like a browser.
    const agent = request.agent(app);
    const reg = await agent.post('/auth/register').send(VALID_USER).expect(201);

    // Prove the ORIGINAL access token works before we refresh.
    expect(await agent.get('/users/me').expect(200)).toBeDefined();
    const oldAccess = extractCookie(reg.headers['set-cookie'], 'access_token');
    const oldRefresh = extractCookie(reg.headers['set-cookie'], 'refresh_token');
    expect(oldAccess).toBeDefined();
    expect(oldRefresh).toBeDefined();

    // Exchange the refresh cookie for a fresh access token.
    const res = await agent.post('/auth/refresh');
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBeDefined();

    // A NEW access token was minted — not the same one replayed.
    const newAccess = extractCookie(res.headers['set-cookie'], 'access_token');
    expect(newAccess).toBeDefined();
    expect(newAccess).not.toBe(oldAccess);

    // The refresh token is static: the refresh response must NOT rotate it, so
    // no refresh_token set-cookie appears in the response.
    expect(extractCookie(res.headers['set-cookie'], 'refresh_token')).toBeNull();

    // The original refresh token still works — the agent never got a new one,
    // so a second refresh succeeds off the same cookie.
    expect(await agent.post('/auth/refresh').expect(200)).toBeDefined();

    // The new access token actually works on a protected route.
    const me = await request(app).get('/users/me').set('Cookie', `access_token=${newAccess}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(VALID_USER.email);
  });

  it('rejects with 401 when no refresh cookie is present', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('rejects with 401 when the refresh token is invalid', async () => {
    // A garbage refresh token must be rejected as unauthorized, not blow up
    // into a 500. (Regression test for the missing try/catch in the handler.)
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'refresh_token=not-a-real-jwt');
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/google', () => {
  it('redirects to the Google consent screen', async () => {
    const res = await request(app).get('/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });
});
