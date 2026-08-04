const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const userRepository = require('../repositories/userRepository');
const AppError = require('./AppError');

const ACCESS_TTL = '1h';
const REFRESH_TTL = '30d';

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Hash a plaintext password with bcrypt.
 * @param {string} plaintext - Raw password from the client.
 * @returns {Promise<string>} The bcrypt hash to store in the DB.
 */
function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, 10);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 * @param {string} plaintext - Raw password from the login form.
 * @param {string} hash - Stored bcrypt hash.
 * @returns {Promise<boolean>} True when the password matches.
 */
function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Sign both the access (1h) and refresh (30d) JWTs for a user.
 * Uses separate secrets so a leaked access token can't mint refresh tokens.
 * @param {number} userId - Database id to embed in both tokens.
 * @returns {{accessToken: string, refreshToken: string}}
 */
function signTokens(userId) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TTL,
  });
  return { accessToken, refreshToken };
}

/**
 * Verify an access token; throws if invalid or expired.
 * @param {string} token - JWT from the access_token cookie.
 * @returns {object} Decoded payload (contains userId).
 */
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

/**
 * Verify a refresh token; throws if invalid or expired.
 * @param {string} token - JWT from the refresh_token cookie.
 * @returns {object} Decoded payload (contains userId).
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

/**
 * Authenticate with email + password and return the user's id.
 * Throws 401 for unknown users, Google-only accounts, or a bad password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<number>} The authenticated user's user_id.
 */
async function loginWithPassword(email, password) {
  const user = await userRepository.findByEmail(email);
  if (!user || !user.password_hash) {
    throw new AppError(401, 'Invalid credentials');
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'Invalid credentials');
  }
  return user.user_id;
}

/**
 * Build the Google consent screen URL the browser is redirected to.
 * @returns {string} Full Google OAuth authorize URL.
 */
function getGoogleAuthUrl() {
  return googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
  });
}

/**
 * Exchange the Google authorization code for tokens and return the id_token.
 * @param {string} code - One-time code from Google's callback query string.
 * @returns {Promise<string>} Google id_token used to identify the user.
 */
async function exchangeGoogleCode(code) {
  const { tokens } = await googleClient.getToken(code);
  if (!tokens.id_token) {
    throw new AppError(400, 'Google did not return an ID token');
  }
  return tokens.id_token;
}

/**
 * Verify a Google id_token and resolve it to a local user, creating or
 * linking an account as needed (upsert on email or google_id).
 * @param {string} idToken - Google id_token from the OAuth callback.
 * @returns {Promise<number>} The local user's user_id.
 */
async function loginWithGoogle(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  const email = payload.email;
  const googleId = payload.sub;

  let user = await userRepository.findByGoogleId(googleId);
  if (!user) {
    user = await userRepository.findByEmail(email);
    if (user) {
      const userId = await userRepository.linkGoogleId(user.user_id, googleId);
      return userId;
    }
    return userRepository.create({
      email,
      passwordHash: null,
      googleId,
    });
  }
  return user.user_id;
}

module.exports = {
  ACCESS_TTL,
  REFRESH_TTL,
  hashPassword,
  verifyPassword,
  signTokens,
  verifyAccessToken,
  verifyRefreshToken,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  loginWithPassword,
  loginWithGoogle,
};

