const { randomUUID } = require('crypto');
const userRepository = require('../repositories/userRepository');
const { pool } = require('../db/pool');
const AppError = require('./AppError');
const { passwordHasher } = require('./passwordHasher');
const { jwtService } = require('./jwtService');

const ACCESS_TTL = jwtService.constructor.ACCESS_TTL;
const REFRESH_TTL = jwtService.constructor.REFRESH_TTL;

/** Special character = anything that is not a letter or digit. */
const SPECIAL_CHAR_RE = /[^A-Za-z0-9]/;
/** Uppercase letter anywhere in the password. */
const UPPERCASE_RE = /[A-Z]/;

/**
 * Enforce the app's password policy. Throws a 400 AppError when the password
 * is too short, has no uppercase letter, or has no special character. Every
 * password-setting path (register, change-password, reset-password) calls this
 * before hashing so the same rule applies everywhere.
 * @param {string} password - Plaintext password to validate.
 * @returns {void}
 */
function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length <= 8) {
    throw new AppError(400, 'Password must be longer than 8 characters');
  }
  if (!UPPERCASE_RE.test(password)) {
    throw new AppError(400, 'Password must contain at least one capital letter');
  }
  if (!SPECIAL_CHAR_RE.test(password)) {
    throw new AppError(400, 'Password must contain at least one special character');
  }
}

/**
 * Hash a plaintext password with bcrypt (via PasswordHasher).
 * @param {string} plaintext - Raw password from the client.
 * @returns {Promise<string>} The bcrypt hash to store in the DB.
 */
function hashPassword(plaintext) {
  return passwordHasher.hash(plaintext);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 * @param {string} plaintext - Raw password from the login form.
 * @param {string} hash - Stored bcrypt hash.
 * @returns {Promise<boolean>} True when the password matches.
 */
function verifyPassword(plaintext, hash) {
  return passwordHasher.compare(plaintext, hash);
}

/**
 * Sign a single access token (1h). Used by the refresh route, which mints
 * only an access token — the long-lived refresh token is static and is never
 * rotated. Each token carries a unique jwtid so every refresh produces a
 * genuinely new token string, even within the same second. Both tokens embed
 * the user's password_it at issuance: if the password changes the version
 * bumps and every older token is rejected by the middleware/refresh route.
 * @param {string} userId - Database id to embed in the token.
 * @param {number} passwordIt - The user's current password_it.
 * @returns {string} Signed access token.
 */
function signAccessToken(userId, passwordIt) {
  return jwtService.signAccessToken(userId, passwordIt);
}

/**
 * Sign both the access (1h) and refresh (30d) JWTs for a user.
 * Used on first login (register/login). The refresh token is issued
 * exactly once here and is static thereafter; only access tokens get minted
 * again (by signAccessToken on /auth/refresh).
 * Uses separate secrets so a leaked access token can't mint refresh tokens.
 * Both tokens embed passwordIt so a password change revokes them.
 * @param {string} userId - Database id to embed in both tokens.
 * @param {number} passwordIt - The user's current password_it.
 * @returns {{accessToken: string, refreshToken: string}}
 */
function signTokens(userId, passwordIt) {
  const accessToken = signAccessToken(userId, passwordIt);
  const refreshToken = jwtService.signRefreshToken(userId, passwordIt);
  return { accessToken, refreshToken };
}

/**
 * Verify an access token; throws if invalid or expired.
 * @param {string} token - JWT from the access_token cookie.
 * @returns {object} Decoded payload (contains userId).
 */
function verifyAccessToken(token) {
  return jwtService.verifyAccessToken(token);
}

/**
 * Verify a refresh token; throws if invalid or expired.
 * @param {string} token - JWT from the refresh_token cookie.
 * @returns {object} Decoded payload (contains userId).
 */
function verifyRefreshToken(token) {
  return jwtService.verifyRefreshToken(token);
}

/**
 * Authenticate with email + password and return the user row.
 * Throws 401 for unknown users or a bad password.
 * The caller decides what to do about an unverified email (issue a code and
 * refuse to sign the user in).
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} The authenticated user's row (full record,
 *   including password_hash for verification and password_it for tokens).
 */
async function loginWithPassword(email, password) {
  // No session exists yet — publish the email so the RLS policy on users
  // (users_self) lets this lookup through before any user id is known.
  const user = await pool.runWithContext({ email }, () => userRepository.findByEmail(email));
  if (!user || !user.password_hash) {
    throw new AppError(401, 'Invalid credentials');
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'Invalid credentials');
  }
  return user;
}

module.exports = {
  ACCESS_TTL,
  REFRESH_TTL,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  signTokens,
  signAccessToken,
  verifyAccessToken,
  verifyRefreshToken,
  loginWithPassword,
};
