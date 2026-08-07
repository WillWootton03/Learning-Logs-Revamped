const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

/**
 * JwtService wraps jsonwebtoken and owns every JWT the app issues or verifies.
 *
 * The app mints three kinds of token:
 *   - access  (1h, signed with JWT_ACCESS_SECRET)  — carries the user's
 *     password_it so a password change revokes it
 *   - refresh (30d, signed with JWT_REFRESH_SECRET) — static, never rotated;
 *     also embeds password_it
 *   - email   (24h, signed with JWT_EMAIL_SECRET)   — stateless verification
 *     code with sub = user id
 *
 * Each token gets a unique jwtid, so every signature produces a genuinely new
 * token string. Separate secrets mean a leaked access token can't mint
 * refresh tokens.
 */
class JwtService {
  static ACCESS_TTL = '1h';
  static REFRESH_TTL = '30d';
  static EMAIL_TTL = '24h';

  /**
   * Sign a fresh access token for a user.
   * @param {string} userId - Database id to embed in the token.
   * @param {number} passwordIt - The user's current password_it.
   * @returns {string} Signed access token.
   */
  signAccessToken(userId, passwordIt) {
    return jwt.sign({ userId, passwordIt }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: JwtService.ACCESS_TTL,
      jwtid: randomUUID(),
    });
  }

  /**
   * Sign a fresh refresh token for a user (issued once per login).
   * @param {string} userId - Database id to embed in the token.
   * @param {number} passwordIt - The user's current password_it.
   * @returns {string} Signed refresh token.
   */
  signRefreshToken(userId, passwordIt) {
    return jwt.sign({ userId, passwordIt }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: JwtService.REFRESH_TTL,
      jwtid: randomUUID(),
    });
  }

  /**
   * Sign a short-lived email-verification token (the emailed "code").
   * @param {string} userId - User id (UUID) embedded as sub.
   * @returns {string} Signed JWT.
   */
  signEmailToken(userId) {
    return jwt.sign({ sub: userId }, process.env.JWT_EMAIL_SECRET, {
      expiresIn: JwtService.EMAIL_TTL,
      jwtid: randomUUID(),
    });
  }

  /**
   * Verify an access token; throws if invalid or expired.
   * @param {string} token - JWT from the access_token cookie.
   * @returns {object} Decoded payload (contains userId, passwordIt).
   */
  verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  }

  /**
   * Verify a refresh token; throws if invalid or expired.
   * @param {string} token - JWT from the refresh_token cookie.
   * @returns {object} Decoded payload (contains userId, passwordIt).
   */
  verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  }

  /**
   * Verify an email token; throws if invalid or expired.
   * @param {string} token - JWT from the emailed link/code.
   * @returns {object} Decoded payload (contains sub = userId).
   */
  verifyEmailToken(token) {
    return jwt.verify(token, process.env.JWT_EMAIL_SECRET);
  }
}

const jwtService = new JwtService();

module.exports = { JwtService, jwtService };
