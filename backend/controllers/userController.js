const userService = require('../services/userService');
const passwordService = require('../services/passwordService');
const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');
const verificationService = require('../services/verificationService');
const asyncHandler = require('../middleware/asyncHandler');
const { setAuthCookies } = require('../utils/cookies');

/**
 * GET /users/me — return the currently authenticated user (from req.userId,
 * set by the authenticate middleware). This is the only user endpoint; a user
 * can only ever see or act on their own account.
 */
async function me(req, res) {
  const user = await userService.getById(req.userId);
  return res.status(200).json(user);
}

/**
 * PUT /users/me — update the authenticated user's name and/or email. Password
 * changes live on their own endpoint (PUT /users/me/password) so credential
 * writes never share a code path with profile updates.
 */
async function update(req, res) {
  const { name, email } = req.body;
  if (name === undefined && !email) {
    return res.status(400).json({ error: 'Provide a name and/or email to update' });
  }
  // Changing the email marks the account unverified; the new address must be
  // confirmed before it can log in again, so email a fresh code immediately.
  const before = await userRepository.findById(req.userId);
  const emailChanged =
    email !== undefined && email.toLowerCase() !== (before?.email || '').toLowerCase();
  const user = await userService.update(req.userId, {
    fullName: name,
    email,
  });
  if (emailChanged) {
    await verificationService.issueToken(req.userId, { force: true });
  }
  return res.status(200).json(user);
}

/**
 * PUT /users/me/password — verify the current password and replace it with a
 * hash of the new one. Scoped to the authenticated user (req.userId). The
 * change bumps password_it, revoking every other device's tokens; the current
 * session gets fresh cookies against the new version so the user stays signed
 * in on this device.
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  const result = await passwordService.changePassword(req.userId, currentPassword, newPassword);
  // Re-issue cookies bound to the new password_it: other sessions are dead,
  // this one carries on.
  const tokens = authService.signTokens(result.user_id, result.password_it);
  setAuthCookies(res, tokens);
  return res.status(200).json(result);
}

/**
 * DELETE /users/me — delete the authenticated user's account.
 */
async function remove(req, res) {
  const result = await userService.remove(req.userId);
  return res.status(200).json(result);
}

module.exports = {
  me: asyncHandler(me),
  update: asyncHandler(update),
  changePassword: asyncHandler(changePassword),
  remove: asyncHandler(remove),
};
