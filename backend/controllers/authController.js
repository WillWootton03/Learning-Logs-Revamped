const authService = require('../services/authService');
const userService = require('../services/userService');
const asyncHandler = require('../middleware/asyncHandler');
const {
  REFRESH_COOKIE,
  setAuthCookies,
  setAccessCookie,
  clearAuthCookies,
} = require('../utils/cookies');

/**
 * POST /auth/register — create a new account, then log it in.
 * Hashes the password, stores the user, and sets the JWT cookies.
 */
async function register(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const passwordHash = await authService.hashPassword(password);
  const user = await userService.create({ email, passwordHash, googleId: null });
  const tokens = authService.signTokens(user.user_id);
  setAuthCookies(res, tokens);
  return res.status(201).json({ user_id: user.user_id });
}

/**
 * POST /auth/login — verify email + password and set JWT cookies.
 */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const userId = await authService.loginWithPassword(email, password);
  const tokens = authService.signTokens(userId);
  setAuthCookies(res, tokens);
  return res.status(200).json({ user_id: userId });
}

/**
 * POST /auth/logout — clear the httpOnly JWT cookies. The tokens themselves
 * stay valid until expiry; there is no server-side session to revoke.
 */
async function logout(req, res) {
  clearAuthCookies(res);
  return res.status(204).end();
}

/**
 * POST /auth/refresh — exchange a valid refresh cookie for a fresh access
 * token. Called by the client when the access token has expired (after ~1h).
 * The refresh token is static: it is issued once at login and is never
 * rotated, so this route only mints a new access token and leaves the refresh
 * cookie untouched.
 */
async function refresh(req, res) {
  const token = req.cookies[REFRESH_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Refresh token missing' });
  }
  // A malformed or expired refresh token must yield 401 (not a 500), matching
  // the authenticate middleware's treatment of bad access tokens.
  let payload;
  try {
    payload = authService.verifyRefreshToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
  const accessToken = authService.signAccessToken(payload.userId);
  setAccessCookie(res, accessToken);
  return res.status(200).json({ user_id: payload.userId });
}

/**
 * GET /auth/google — start OAuth by redirecting the browser to Google's
 * consent screen.
 */
async function googleStart(req, res) {
  const url = authService.getGoogleAuthUrl();
  return res.redirect(url);
}

/**
 * GET /auth/google/callback — Google redirects here after consent.
 * Exchanges the code for an id_token, resolves/logs in the user, sets the
 * same JWT cookies as password login, then sends the browser to the frontend.
 */
async function googleCallback(req, res) {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }
  const idToken = await authService.exchangeGoogleCode(code);
  const userId = await authService.loginWithGoogle(idToken);
  const tokens = authService.signTokens(userId);
  setAuthCookies(res, tokens);
  const redirectTo = process.env.FRONTEND_URL || '/';
  return res.redirect(redirectTo);
}

module.exports = {
  register: asyncHandler(register),
  login: asyncHandler(login),
  logout: asyncHandler(logout),
  refresh: asyncHandler(refresh),
  googleStart: asyncHandler(googleStart),
  googleCallback: asyncHandler(googleCallback),
};
