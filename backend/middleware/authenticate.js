const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');
const { pool } = require('../db/pool');
const { ACCESS_COOKIE, clearAuthCookies } = require('../utils/cookies');

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
 *
 * Password versioning: tokens embed the user's password_it at issuance. If it
 * no longer matches the account's current value, the password changed since
 * the token was minted — the session is stale, so the cookies are revoked and
 * the request is rejected, forcing the client back to the login page.
 *
 * RLS: the rest of the request runs inside pool.runAsUser(payload.userId), so
 * the database session's app.current_user_id is set for every query this
 * request performs and the row-level-security policies in db/schema.sql scope
 * all reads/writes to this user. The scope is held open until the response
 * finishes so handlers downstream of next() stay covered.
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
    await pool.runAsUser(payload.userId, async () => {
      // Re-check the user exists so tokens minted for deleted accounts stop
      // working immediately rather than riding out their 1h lifetime.
      const user = await userRepository.findById(payload.userId);
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      // A password change bumped password_it — tokens issued before it are
      // stale. Revoke the cookies and demand a fresh login.
      if (payload.passwordIt !== user.password_it) {
        clearAuthCookies(res);
        res.status(401).json({
          error: 'Password changed. Please sign in again.',
          code: 'PASSWORD_CHANGED',
        });
        return;
      }
      req.userId = payload.userId;
      next();
      // Keep the user context alive until the response completes so every
      // query downstream of next() is scoped to this user by RLS.
      await new Promise((resolve) => res.once('finish', resolve));
    });
  } catch (err) {
    next(err); // genuine server/db failure -> global error handler (500)
  }
}

module.exports = authenticate;
