const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');
const { ACCESS_COOKIE } = require('../utils/cookies');

/**
 * Express 4 middleware that protects routes behind a valid access token.
 * Reads the access_token cookie, verifies it, and stores the user id on
 * req.userId for downstream handlers. Responds 401 on any failure.
 *
 * The token is only trusted while its user still exists: an account that was
 * deleted (or has since lost access) must not keep using its old token, so we
 * confirm the row before letting the request through. This makes every
 * protected route uniformly return 401 for deleted accounts.
 */
async function authenticate(req, res, next) {
  const token = req.cookies[ACCESS_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  let payload;
  try {
    payload = authService.verifyAccessToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
  try {
    const user = await userRepository.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }
    req.userId = payload.userId;
    next();
  } catch (err) {
    next(err); // genuine server/db failure -> global error handler (500)
  }
}

module.exports = authenticate;
