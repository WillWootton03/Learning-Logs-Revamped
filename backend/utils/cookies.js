const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

/**
 * Options shared by both auth cookies. httpOnly keeps the tokens out of
 * reach of any client-side JS (XSS protection); `secure` only applies over
 * HTTPS, which is why it's tied to NODE_ENV.
 * @returns {object} Cookie option object.
 */
function baseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

/**
 * Access token cookie lives for 1 hour, matching the JWT expiry.
 */
function accessCookieOptions() {
  return {
    ...baseCookieOptions(),
    maxAge: 60 * 60 * 1000,
  };
}

/**
 * Refresh token cookie lives for 30 days, matching the JWT expiry.
 */
function refreshCookieOptions() {
  return {
    ...baseCookieOptions(),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

/**
 * Write both JWT cookies onto the response (first login: register/login/google).
 * @param {object} res - Express response.
 * @param {{accessToken: string, refreshToken: string}} tokens
 */
function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

/**
 * Write only the access token cookie. Used by /auth/refresh and by the
 * authenticate middleware's transparent refresh, both of which leave the
 * static refresh cookie untouched.
 * @param {object} res - Express response.
 * @param {string} accessToken
 */
function setAccessCookie(res, accessToken) {
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
}

/**
 * Expire both auth cookies (used by logout).
 * @param {object} res - Express response.
 */
function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions());
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setAuthCookies,
  setAccessCookie,
  clearAuthCookies,
};
