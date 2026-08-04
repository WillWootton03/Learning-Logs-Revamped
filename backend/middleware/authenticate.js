const authService = require('../services/authService');
const { ACCESS_COOKIE } = require('../utils/cookies');

/**
 * Express 4 middleware that protects routes behind a valid access token.
 * Reads the access_token cookie, verifies it, and stores the user id on
 * req.userId for downstream handlers. Responds 401 on any failure.
 */
function authenticate(req, res, next) {
  const token = req.cookies[ACCESS_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = authService.verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

module.exports = authenticate;
