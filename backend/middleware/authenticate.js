const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');
const { ACCESS_COOKIE } = require('../utils/cookies');

/**
 * Verify the access token from the httpOnly cookie and attach the user's id
 * to the request.
 *
 * This middleware ONLY authenticates — it never mints tokens. When the access
 * token is missing, expired, or tampered with, it returns a clean 401 and the
 * shared frontend client responds by calling POST /auth/refresh (a dedicated,
 * observable endpoint) and retrying the request. Keeping refresh on that route
 * makes every token renewal visible in the server logs, which is much easier
 * to track and debug than an inline mint buried in the middleware.
 */
async function authenticate(req, res, next) {
  const accessToken = req.cookies[ACCESS_COOKIE];
  if (!accessToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let payload;
  try {
    payload = authService.verifyAccessToken(accessToken);
  } catch (err) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Re-check the user exists so tokens minted for deleted accounts stop
    // working immediately rather than riding out their 1h lifetime.
    const user = await userRepository.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.userId = payload.userId;
    next();
  } catch (err) {
    next(err); // genuine server/db failure -> global error handler (500)
  }
}

module.exports = authenticate;
