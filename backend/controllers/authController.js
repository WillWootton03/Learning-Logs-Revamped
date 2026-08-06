const authService = require('../services/authService');
const userService = require('../services/userService');
const verificationService = require('../services/verificationService');
const passwordResetService = require('../services/passwordResetService');
const userRepository = require('../repositories/userRepository');
const asyncHandler = require('../middleware/asyncHandler');
const {
  REFRESH_COOKIE,
  setAuthCookies,
  setAccessCookie,
  clearAuthCookies,
} = require('../utils/cookies');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * POST /auth/register — create a new account and send a verification code.
 * Accounts start unverified: no JWT cookies are issued until the email is
 * confirmed via POST /auth/verify.
 */
async function register(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const passwordHash = await authService.hashPassword(password);
  const user = await userService.create({ email, passwordHash, googleId: null });
  // force=true skips the cooldown check so the very first code always goes out.
  await verificationService.issueToken(user.user_id, { force: true });
  return res.status(201).json({
    email: user.email,
    requiresVerification: true,
  });
}

/**
 * POST /auth/login — verify email + password. If the account exists but its
 * email is unverified, no tokens are issued: a fresh code is emailed (subject
 * to the resend cooldown) and the client is told to run the verification flow.
 */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = await authService.loginWithPassword(email, password);
  if (!user.email_verified) {
    // A code was likely sent at registration; if the cooldown is still active
    // that's fine — the client just shows the existing-code prompt.
    try {
      await verificationService.issueToken(user.user_id);
    } catch (err) {
      if (err.status !== 429) throw err;
    }
    return res.status(403).json({
      error: 'Email not verified. Enter the code we sent you, or request a new one.',
      code: 'EMAIL_NOT_VERIFIED',
      email: user.email,
    });
  }
  const tokens = authService.signTokens(user.user_id, user.password_it);
  setAuthCookies(res, tokens);
  return res.status(200).json({ user_id: user.user_id });
}

/**
 * POST /auth/verify — confirm a stateless verification token. The token is a
 * signed JWT, so verification is just a signature check; on success the email
 * is marked verified and the user is signed in (tokens issued) so registration
 * flows straight into the app.
 */
async function verify(req, res) {
  const { code } = req.body;
  const token = typeof code === 'string' && code.trim() ? code.trim() : req.body.token;
  if (!token) {
    return res.status(400).json({ error: 'A verification code is required' });
  }
  const userId = verificationService.verifyToken(token);
  await userRepository.setEmailVerified(userId);
  const user = await userRepository.findById(userId);
  const tokens = authService.signTokens(userId, user.password_it);
  setAuthCookies(res, tokens);
  return res.status(200).json({ user_id: userId });
}

/**
 * POST /auth/resend-verification — email a fresh code to an unverified account.
 * Enforced 60s cooldown via verificationService; the response carries how long
 * to wait.
 */
async function resendVerification(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const user = await userRepository.findByEmail(email.trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'No account found with that email' });
  }
  if (user.email_verified) {
    return res.status(400).json({ error: 'Email is already verified', code: 'EMAIL_ALREADY_VERIFIED' });
  }
  const result = await verificationService.issueToken(user.user_id);
  return res.status(200).json(result);
}

/**
 * POST /auth/forgot-password — start a password reset for an email. Always
 * responds 200 (whether or not the account exists) so the endpoint can't be
 * used to probe which emails are registered. A reset token is stored and
 * emailed only when the account exists.
 */
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  await passwordResetService.requestReset(email);
  return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
}

/**
 * POST /auth/reset-password — set a new password using a token from a reset
 * email. The token resolves to the user id, their password_hash is replaced
 * with a hash of the new password, and the token is burned (single use).
 */
async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  await passwordResetService.resetPassword(token, password);
  return res.status(200).json({ message: 'Password updated. You can sign in now.' });
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
  // Password versioning: a refresh token minted before a password change is
  // stale. Revoke the cookies so the client returns to the login page.
  const user = await userRepository.findById(payload.userId);
  if (!user || user.password_it !== payload.passwordIt) {
    clearAuthCookies(res);
    return res.status(401).json({
      error: 'Password changed. Please sign in again.',
      code: 'PASSWORD_CHANGED',
    });
  }
  const accessToken = authService.signAccessToken(user.user_id, user.password_it);
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
 * Unverified accounts (per the OTP policy, Google accounts included) are sent
 * to the verify page instead of being signed in.
 */
async function googleCallback(req, res) {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }
  const idToken = await authService.exchangeGoogleCode(code);
  const user = await authService.loginWithGoogle(idToken);
  if (!user.email_verified) {
    try {
      await verificationService.issueToken(user.user_id);
    } catch (err) {
      if (err.status !== 429) throw err;
    }
    const verifyUrl = `${FRONTEND_URL}/verify?email=${encodeURIComponent(user.email)}`;
    return res.redirect(verifyUrl);
  }
  const tokens = authService.signTokens(user.user_id, user.password_it);
  setAuthCookies(res, tokens);
  return res.redirect(FRONTEND_URL);
}

module.exports = {
  register: asyncHandler(register),
  login: asyncHandler(login),
  verify: asyncHandler(verify),
  resendVerification: asyncHandler(resendVerification),
  forgotPassword: asyncHandler(forgotPassword),
  resetPassword: asyncHandler(resetPassword),
  logout: asyncHandler(logout),
  refresh: asyncHandler(refresh),
  googleStart: asyncHandler(googleStart),
  googleCallback: asyncHandler(googleCallback),
};
