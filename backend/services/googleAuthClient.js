const { OAuth2Client } = require('google-auth-library');

/**
 * GoogleAuthClient wraps google-auth-library's OAuth2Client so the rest of the
 * app never talks to the library directly. Config comes from GOOGLE_* env vars
 * (set in .env for the dev backend / the OAuth callback origin).
 *
 * Only the three operations the app needs are exposed:
 *   - getAuthUrl()       — build the consent-screen URL for login redirects
 *   - getToken(code)     — exchange Google's one-time code for tokens
 *   - verifyIdToken(...) — verify an id_token and hand back the ticket
 */
class GoogleAuthClient {
  /**
   * @param {object} [config] - Overrides for GOOGLE_CLIENT_ID / _SECRET / _URI.
   */
  constructor({
    clientId = process.env.GOOGLE_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CLIENT_SECRET,
    redirectUri = process.env.GOOGLE_REDIRECT_URI,
  } = {}) {
    this.client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  /**
   * Build the Google consent screen URL the browser is redirected to.
   * @returns {string} Full Google OAuth authorize URL.
   */
  getAuthUrl() {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
    });
  }

  /**
   * Exchange the Google authorization code for token payloads.
   * @param {string} code - One-time code from Google's callback query string.
   * @returns {Promise<{tokens: object}>} The token response (contains id_token).
   */
  getToken(code) {
    return this.client.getToken(code);
  }

  /**
   * Verify a Google id_token against our client id.
   * @param {{idToken: string, audience: string}} opts - Token + expected audience.
   * @returns {Promise<object>} The ticket (call getPayload() on it for claims).
   */
  verifyIdToken(opts) {
    return this.client.verifyIdToken(opts);
  }
}

const googleAuthClient = new GoogleAuthClient();

module.exports = { GoogleAuthClient, googleAuthClient };
