/**
 * Integration tests for password reset:
 *   POST /auth/forgot-password — email a reset link, storing a token
 *   POST /auth/reset-password — swap the token for a new password
 *
 * These exercise the real Express app, the real password_resets table, and
 * real bcrypt round-trips through supertest. The mailer is mocked so no SMTP
 * traffic happens; tokens are read straight from the database.
 *
 * Key behaviors verified:
 *   - requesting a reset stores a token + emails the link
 *   - an unknown email gets the same 200 (no account enumeration)
 *   - a second request overwrites the previous token (one live link per user)
 *   - a valid token changes the password (old fails, new works) and is burned
 *   - invalid / expired tokens are rejected with 400
 *
 * DB requirements: same as auth.test.js (dedicated test DB, wiped per test).
 */
const request = require('supertest');
const app = require('../../app');
const { pool } = require('../../db/pool');
const { truncateAll } = require('./helpers/db');
const { registerVerifiedUser } = require('./helpers/auth');

jest.mock('../../services/mailer', () => ({
  mailer: {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  },
}));
const { mailer } = require('../../services/mailer');

const VALID_USER = { email: 'ada@example.com', password: 'Password123!' };

/**
 * Read the stored reset token for a user directly from the DB. password_resets
 * is RLS-scoped, so the read runs under the user's own context.
 */
async function storedToken(userId) {
  const result = await pool.runWithContext({ userId }, () =>
    pool.query('SELECT token FROM password_resets WHERE user_id = $1', [userId])
  );
  return result.rows[0] ? result.rows[0].token : null;
}

/**
 * Pull the value of a named cookie out of a `set-cookie` header array.
 * @param {string[]|undefined} setCookie - res.headers['set-cookie'].
 * @param {string} name - Cookie name, e.g. 'refresh_token'.
 * @returns {string|null} The cookie value, or null if absent.
 */
function extractCookie(setCookie, name) {
  const header = (setCookie || []).find((c) => c.startsWith(`${name}=`));
  return header ? header.split(';')[0].split('=')[1] : null;
}

beforeEach(async () => {
  await truncateAll();
  mailer.sendPasswordResetEmail.mockClear();
});

describe('POST /auth/forgot-password', () => {
  it('stores a reset token and emails a link for a registered email', async () => {
    const { user } = await registerVerifiedUser(VALID_USER);

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: VALID_USER.email });

    expect(res.status).toBe(200);
    // The token is persisted and emailed.
    const token = await storedToken(user.user_id);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(mailer.sendPasswordResetEmail).toHaveBeenCalledWith(
      VALID_USER.email,
      expect.objectContaining({ token })
    );
  });

  it('answers 200 for an unknown email without storing or emailing', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'ghost@example.com' });

    expect(res.status).toBe(200);
    expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM password_resets');
    expect(count.rows[0].n).toBe(0);
  });

  it('overwrites the previous token on a second request (one live link per user)', async () => {
    const { user } = await registerVerifiedUser(VALID_USER);

    await request(app).post('/auth/forgot-password').send({ email: VALID_USER.email });
    const first = await storedToken(user.user_id);
    await request(app).post('/auth/forgot-password').send({ email: VALID_USER.email });
    const second = await storedToken(user.user_id);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    // Still exactly one row for the user.
    const count = await pool.runWithContext({ userId: user.user_id }, () =>
      pool.query('SELECT COUNT(*)::int AS n FROM password_resets WHERE user_id = $1', [user.user_id])
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('rejects a missing email with 400', async () => {
    const res = await request(app).post('/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/reset-password', () => {
  it('updates the password with a valid token, and the token is burned', async () => {
    const { user } = await registerVerifiedUser(VALID_USER);
    await request(app).post('/auth/forgot-password').send({ email: VALID_USER.email });
    const token = await storedToken(user.user_id);

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'NewPassword123!' });

    expect(res.status).toBe(200);

    // The token is single-use — it no longer exists in the DB.
    expect(await storedToken(user.user_id)).toBeNull();

    // Old password is dead...
    const oldLogin = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    expect(oldLogin.status).toBe(401);

    // ...and the new password authenticates.
    const newLogin = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: 'NewPassword123!' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an unknown token with 400', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'f'.repeat(64), password: 'NewPassword123!' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('rejects an expired token with 400', async () => {
    const { user } = await registerVerifiedUser(VALID_USER);
    await request(app).post('/auth/forgot-password').send({ email: VALID_USER.email });
    const token = await storedToken(user.user_id);
    // Age the token past the 1h TTL. The password_resets WITH CHECK clause only
    // permits writes under the owning user's id, so the aging update runs with
    // the userId context (the same identity the app uses when consuming a token).
    await pool.runWithContext({ userId: user.user_id }, () =>
      pool.query(
        `UPDATE password_resets SET requested_at = now() - interval '2 hours' WHERE token = $1`,
        [token]
      )
    );

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'NewPassword123!' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RESET_TOKEN_EXPIRED');
    // The old password is untouched.
    const login = await request(app).post('/auth/login').send(VALID_USER);
    expect(login.status).toBe(200);
  });

  it('rejects a missing token or password with 400', async () => {
    const noToken = await request(app).post('/auth/reset-password').send({ password: 'new-pass' });
    expect(noToken.status).toBe(400);

    const noPassword = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'a'.repeat(64) });
    expect(noPassword.status).toBe(400);
  });

  it('revokes every session signed in before the reset (password versioning)', async () => {
    const { agent, user } = await registerVerifiedUser(VALID_USER);
    // Re-login so we can grab a refresh token minted before the reset.
    const login = await agent.post('/auth/login').send(VALID_USER).expect(200);
    const staleRefresh = extractCookie(login.headers['set-cookie'], 'refresh_token');
    expect(await agent.get('/users/me').expect(200)).toBeDefined();

    await request(app).post('/auth/forgot-password').send({ email: VALID_USER.email });
    const token = await storedToken(user.user_id);
    await request(app).post('/auth/reset-password').send({ token, password: 'NewPassword123!' }).expect(200);

    // The session that predates the reset is dead: access token rejected with
    // PASSWORD_CHANGED and the cookies revoked.
    const denied = await agent.get('/users/me');
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('PASSWORD_CHANGED');
    const cookies = (denied.headers['set-cookie'] || []).join(';');
    expect(cookies).toContain('access_token=;');
    expect(cookies).toContain('refresh_token=;');

    // The stale refresh token can't mint a new access token either — the
    // refresh route rejects it with PASSWORD_CHANGED.
    const refused = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refresh_token=${staleRefresh}`);
    expect(refused.status).toBe(401);
    expect(refused.body.code).toBe('PASSWORD_CHANGED');
  });
});
