/**
 * Shared integration-test helpers for the auth flow.
 *
 * Registering an account no longer signs the user in — email verification is
 * required first. These helpers complete that flow so other suites can start
 * from a verified, cookie-carrying agent. The verification token is a
 * stateless JWT, so the helper signs one directly with the real
 * verificationService (JWT_EMAIL_SECRET is set by jest.setup.js) and posts it
 * through the real POST /auth/verify endpoint — no mailer mock needed.
 */
const request = require('supertest');
const app = require('../../../app');
const userRepository = require('../../../repositories/userRepository');
const { pool } = require('../../../db/pool');
const { generateToken } = require('../../../services/verificationService');

/**
 * Register a user and complete email verification, returning an agent that
 * carries the auth cookies. Agents are supertest's browser-equivalent: they
 * persist set-cookie headers, so the access token is sent automatically.
 *
 * RLS is active in the test DB, and registration runs without a session, so
 * the helper scopes its post-register lookup by email (the same context the
 * backend uses) to read the new user row back.
 * @param {object} body - { email, password } (with any overrides).
 * @returns {Promise<{agent: import('supertest').SuperAgentTest, user: object}>}
 */
async function registerVerifiedUser(body) {
  const agent = request.agent(app);
  const reg = await agent.post('/auth/register').send(body).expect(201);
  const user = await pool.runWithContext({ email: reg.body.email }, () =>
    userRepository.findByEmail(reg.body.email)
  );
  const code = generateToken(user.user_id);
  await agent.post('/auth/verify').send({ code }).expect(200);
  return { agent, user };
}

module.exports = { registerVerifiedUser };
