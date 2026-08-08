const userRepository = require('../repositories/userRepository');
const { pool } = require('../db/pool');
const { mailer } = require('./mailer');
const { jwtService } = require('./jwtService');
const AppError = require('./AppError');

/**
 * Email verification via stateless signed tokens.
 *
 * The "code" emailed to the user is a short-lived JWT carrying the user id.
 * Nothing is stored server-side beyond users.email_verified — verification is
 * purely a signature check against JWT_EMAIL_SECRET, so there is no OTP hash
 * or expiry to persist. A module-level map backs the resend cooldown (it is
 * deliberately not persisted; the DB only ever holds email_verified).
 */

const TOKEN_TTL = jwtService.constructor.EMAIL_TTL;
const RESEND_COOLDOWN_MS = 60 * 1000;

// userId -> last-sent timestamp, in-memory only.
const lastSentAt = new Map();

/**
 * Sign a fresh email-verification token for a user. Each token is unique
 * (jwtid), so a captured link can't be replayed after the previous one.
 * @param {string} userId - User id (UUID).
 * @returns {string} Signed JWT.
 */
function generateToken(userId) {
  return jwtService.signEmailToken(userId);
}

/**
 * Verify a token and resolve the user id it was issued for.
 * @param {string} token - JWT from the emailed link/code.
 * @returns {string} The user id embedded in the token.
 * @throws {AppError} 400 if the token is missing, malformed, or expired.
 */
function verifyToken(token) {
  if (!token) throw new AppError(400, 'A verification code is required', 'TOKEN_REQUIRED');
  let payload;
  try {
    payload = jwtService.verifyEmailToken(token);
  } catch (err) {
    throw new AppError(400, 'This code is invalid or has expired. Request a new one.', 'TOKEN_INVALID');
  }
  if (!payload.sub) {
    throw new AppError(400, 'This code is invalid. Request a new one.', 'TOKEN_INVALID');
  }
  return payload.sub;
}

/**
 * Issue a fresh token for a user and email it. Enforces the resend cooldown
 * unless `force` is set (used for the very first send after registration and
 * for immediate re-verification after an email change).
 * @param {string} userId - User id (UUID).
 * @param {{force?: boolean}} [opts]
 * @returns {Promise<{email: string, resendAfterMs: number}>}
 * @throws {AppError} 400 already verified, 404 user missing, 429 too soon to resend.
 */
async function issueToken(userId, { force = false } = {}) {
  // The user id is already known (from registration or the emailed link), so
  // publish it as the RLS context for the lookup.
  const user = await pool.runWithContext({ userId }, () => userRepository.findById(userId));
  if (!user) throw new AppError(404, 'User not found');
  if (user.email_verified) {
    throw new AppError(400, 'Email is already verified', 'EMAIL_ALREADY_VERIFIED');
  }

  if (!force) {
    const lastSent = lastSentAt.get(userId);
    if (lastSent) {
      const elapsed = Date.now() - lastSent;
      if (elapsed < RESEND_COOLDOWN_MS) {
        const remaining = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new AppError(
          429,
          `Please wait ${remaining}s before requesting another code`,
          'VERIFY_COOLDOWN'
        );
      }
    }
  }

  const token = generateToken(userId);
  lastSentAt.set(userId, Date.now());
  await mailer.sendVerificationEmail(user.email, { code: token });
  return { email: user.email, resendAfterMs: RESEND_COOLDOWN_MS };
}

module.exports = {
  TOKEN_TTL,
  RESEND_COOLDOWN_MS,
  generateToken,
  verifyToken,
  issueToken,
};
