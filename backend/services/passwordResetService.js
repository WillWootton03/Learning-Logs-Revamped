const crypto = require('crypto');
const authService = require('./authService');
const userRepository = require('../repositories/userRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const { pool } = require('../db/pool');
const { mailer } = require('./mailer');
const AppError = require('./AppError');

/**
 * Password reset via emailed links.
 *
 * A request stores a random hex token in the password_resets table (one row
 * per user — a new request overwrites the previous token, so old links die
 * automatically). The emailed link points at the frontend reset-password
 * page, which posts the token + new password; the service resolves the token
 * to the user id, hashes the new password, updates the user, and burns the
 * token so it can't be replayed.
 */

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Generate a 64-char random hex token (256 bits of entropy). */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Start a reset for an email. Responds identically whether or not the email
 * is registered (no user enumeration): the token is stored and emailed only
 * when a matching account exists. Unverified accounts are treated the same as
 * nonexistent ones — no reset email is sent until the address is verified.
 * @param {string} email - The address from the forgot-password form.
 * @returns {Promise<{ok: true}>}
 */
async function requestReset(email) {
  const normalized = email.trim().toLowerCase();
  // Pre-login: scope the email lookup and the token upsert by the RLS policy
  // keys they match (email for the lookup, then the resolved user id).
  const user = await pool.runWithContext({ email: normalized }, () =>
    userRepository.findByEmail(normalized)
  );
  if (user && user.email_verified) {
    const token = generateToken();
    await pool.runWithContext({ userId: user.user_id }, () =>
      passwordResetRepository.upsert(user.user_id, token)
    );
    await mailer.sendPasswordResetEmail(user.email, { token });
  }
  return { ok: true };
}

/**
 * Set a new password using a reset token. The token must exist and be under
 * an hour old; on success the token is deleted (single use) and the user's
 * password_hash is replaced.
 * @param {string} token - Random hex token from the emailed link.
 * @param {string} newPassword - Plaintext password to set.
 * @returns {Promise<{ok: true}>}
 */
async function resetPassword(token, newPassword) {
  if (!token) {
    throw new AppError(400, 'A reset token is required', 'RESET_TOKEN_REQUIRED');
  }
  // Pre-login: the token lookup is scoped by the reset-token policy key, and
  // the password write by the resolved user id.
  const row = await pool.runWithContext({ resetToken: token }, () =>
    passwordResetRepository.findByToken(token)
  );
  if (!row) {
    throw new AppError(400, 'This reset link is invalid. Request a new one.', 'RESET_TOKEN_INVALID');
  }
  const ageMs = Date.now() - new Date(row.requested_at).getTime();
  if (ageMs > RESET_TTL_MS) {
    throw new AppError(400, 'This reset link has expired. Request a new one.', 'RESET_TOKEN_EXPIRED');
  }
  authService.validatePasswordStrength(newPassword);
  const passwordHash = await authService.hashPassword(newPassword);
  await pool.runWithContext({ userId: row.user_id }, () =>
    userRepository.updatePassword(row.user_id, passwordHash)
  );
  await pool.runWithContext({ userId: row.user_id }, () =>
    passwordResetRepository.deleteByToken(token)
  );
  return { ok: true };
}

module.exports = {
  RESET_TTL_MS,
  generateToken,
  requestReset,
  resetPassword,
};
