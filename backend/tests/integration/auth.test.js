/**
 * Integration tests for the /auth routes.
 *
 * Unlike the unit tests, these run the real Express app through supertest
 * against a real PostgreSQL database. They verify the full request lifecycle:
 * bcrypt hashing, JWT signing, httpOnly cookie handling, email verification,
 * and the JSON error middleware — the parts the unit tests deliberately stub.
 *
 * Verification uses stateless JWT codes emailed to the user. To exercise the
 * exact code a user would receive, the mailer is mocked and its calls are
 * captured. No verification state is stored server-side beyond
 * users.email_verified.
 *
 * DB requirements:
 *   - A dedicated test database (see jest.setup.js / globalSetup.js), so dev
 *     data is never touched.
 *   - beforeEach wipes all tables so every test starts clean.
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../app');
const { truncateAll } = require('./helpers/db');
const { registerVerifiedUser } = require('./helpers/auth');
const userRepository = require('../../repositories/userRepository');

jest.mock('../../services/mailer', () => ({
  sendVerificationEmail: jest.fn(),
}));
const mailer = require('../../services/mailer');

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

/** The verification code the last sendVerificationEmail call delivered. */
function lastSentCode() {
  const calls = mailer.sendVerificationEmail.mock.calls;
  return calls[calls.length - 1][1].code;
}

beforeEach(async () => {
  await truncateAll();
  mailer.sendVerificationEmail.mockClear();
});

describe('POST /auth/register', () => {
  it('creates an account, sends a verification code, and issues NO auth cookies', async () => {
    const res = await request(app).post('/auth/register').send(VALID_USER);

    // 201 = resource created; the account starts unverified.
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(VALID_USER.email);
    expect(res.body.requiresVerification).toBe(true);

    // No session until the email is verified — no JWT cookies yet.
    expect(res.headers['set-cookie']).toBeUndefined();

    // A code was actually emailed to the new address.
    expect(mailer.sendVerificationEmail).toHaveBeenCalledWith(VALID_USER.email, {
      code: expect.any(String),
    });
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

describe('POST /auth/verify', () => {
  it('verifies the emailed code and signs the user in', async () => {
    await request(app).post('/auth/register').send(VALID_USER).expect(201);
    const code = lastSentCode();

    const res = await request(app).post('/auth/verify').send({ code });

    expect(res.status).toBe(200);
    expect(res.body.user_id).toBeDefined();
    // Verification signs the user in immediately (registration flows straight
    // into the app).
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toContain('access_token=');
    expect(cookies).toContain('refresh_token=');

    // The verified user can now authenticate with a password.
    const login = await request(app).post('/auth/login').send(VALID_USER);
    expect(login.status).toBe(200);
  });

  it('rejects a garbage code with 400', async () => {
    const res = await request(app).post('/auth/verify').send({ code: 'not-a-valid-token' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing code with 400', async () => {
    const res = await request(app).post('/auth/verify').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials after verification and sets cookies', async () => {
    const { agent } = await registerVerifiedUser(VALID_USER);

    const res = await agent.post('/auth/login').send(VALID_USER);

    expect(res.status).toBe(200);
    expect(res.body.user_id).toBeDefined();
    expect(res.headers['set-cookie'].join(';')).toContain('access_token=');
  });

  it('blocks an unverified account with 403 EMAIL_NOT_VERIFIED and no cookies', async () => {
    await request(app).post('/auth/register').send(VALID_USER).expect(201);

    const res = await request(app).post('/auth/login').send(VALID_USER);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.body.email).toBe(VALID_USER.email);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a wrong password with 401', async () => {
    await request(app).post('/auth/register').send(VALID_USER).expect(201);
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

describe('POST /auth/resend-verification', () => {
  it('emails a fresh code to an unverified account', async () => {
    // Create the account directly (no registration email), so no cooldown is
    // active and the resend is allowed to send.
    const passwordHash = await bcrypt.hash('password123', 10);
    await userRepository.create({
      email: VALID_USER.email,
      fullName: null,
      passwordHash,
      googleId: null,
    });

    const res = await request(app).post('/auth/resend-verification').send({ email: VALID_USER.email });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(VALID_USER.email);
    expect(res.body.resendAfterMs).toBeGreaterThan(0);
    expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(lastSentCode()).toBeDefined();
  });

  it('returns 429 while the resend cooldown is active', async () => {
    await request(app).post('/auth/register').send(VALID_USER).expect(201);

    const res = await request(app).post('/auth/resend-verification').send({ email: VALID_USER.email });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('VERIFY_COOLDOWN');
  });

  it('returns 400 for an already-verified email', async () => {
    await registerVerifiedUser(VALID_USER);
    const res = await request(app).post('/auth/resend-verification').send({ email: VALID_USER.email });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMAIL_ALREADY_VERIFIED');
  });

  it('returns 404 for an unknown email', async () => {
    const res = await request(app).post('/auth/resend-verification').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(404);
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
    const { agent } = await registerVerifiedUser(VALID_USER);
    const login = await agent.post('/auth/login').send(VALID_USER).expect(200);

    // Prove the ORIGINAL access token works before we refresh.
    expect(await agent.get('/users/me').expect(200)).toBeDefined();
    const oldAccess = extractCookie(login.headers['set-cookie'], 'access_token');
    const oldRefresh = extractCookie(login.headers['set-cookie'], 'refresh_token');
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

describe('authenticate middleware (pure auth — refresh lives on /auth/refresh)', () => {
  /**
   * The middleware only checks the access token. When it is missing or
   * expired the request gets a clean 401 — the client then calls the
   * dedicated POST /auth/refresh endpoint itself (see the flow test below).
   * This keeps the middleware single-purpose and makes token renewals
   * visible in the server logs as /auth/refresh calls.
   */
  it('returns 401 when the access token is expired, even with a valid refresh cookie', async () => {
    const { agent } = await registerVerifiedUser(VALID_USER);
    const login = await agent.post('/auth/login').send(VALID_USER).expect(200);
    const refresh = extractCookie(login.headers['set-cookie'], 'refresh_token');

    // Expired/garbage access token. The middleware must NOT mint a new one —
    // that is /auth/refresh's job — so the request fails with 401 and the
    // client (not under test here) would call /auth/refresh and retry.
    const res = await request(app)
      .get('/users/me')
      .set('Cookie', `access_token=expired.garbage.jwt; refresh_token=${refresh}`);

    expect(res.status).toBe(401);
    // No access cookie should be written back by the middleware.
    expect(extractCookie(res.headers['set-cookie'], 'access_token')).toBeNull();
  });

  it('returns 401 on a protected route with only a refresh cookie', async () => {
    const { agent } = await registerVerifiedUser(VALID_USER);
    const login = await agent.post('/auth/login').send(VALID_USER).expect(200);
    const refresh = extractCookie(login.headers['set-cookie'], 'refresh_token');

    const res = await request(app).get('/users/me').set('Cookie', `refresh_token=${refresh}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when both access and refresh tokens are invalid', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Cookie', 'access_token=garbage; refresh_token=also-garbage');
    expect(res.status).toBe(401);
  });

  it('returns 401 when no cookies are present at all', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('supports the client refresh flow: 401, then /auth/refresh, then retry succeeds', async () => {
    const { agent } = await registerVerifiedUser(VALID_USER);
    const login = await agent.post('/auth/login').send(VALID_USER).expect(200);
    const refresh = extractCookie(login.headers['set-cookie'], 'refresh_token');

    // 1. Expired access token -> the middleware returns 401 (no silent mint).
    const denied = await request(app)
      .get('/users/me')
      .set('Cookie', `access_token=expired.garbage.jwt; refresh_token=${refresh}`);
    expect(denied.status).toBe(401);

    // 2. The client then calls POST /auth/refresh with the still-valid refresh
    //    cookie and receives a fresh access token in a new cookie.
    const refreshed = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refresh_token=${refresh}`);
    expect(refreshed.status).toBe(200);
    const newAccess = extractCookie(refreshed.headers['set-cookie'], 'access_token');
    expect(newAccess).toBeDefined();

    // 3. Retrying the original request with the fresh access token succeeds.
    const retry = await request(app)
      .get('/users/me')
      .set('Cookie', `access_token=${newAccess}`);
    expect(retry.status).toBe(200);
    expect(retry.body.email).toBe(VALID_USER.email);
  });
});

describe('GET /auth/google', () => {
  it('redirects to the Google consent screen', async () => {
    const res = await request(app).get('/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });
});
