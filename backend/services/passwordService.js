const authService = require('./authService');
const userRepository = require('../repositories/userRepository');
const AppError = require('./AppError');

/**
 * Signed-in password changes.
 *
 * Distinct from passwordResetService (the forgotten-password flow): this path
 * requires the user's current password, verifies it against the stored hash,
 * and only touches the authenticated user's own record. The write goes
 * through the repository's dedicated updatePassword() so credential updates
 * never share a code path with profile updates.
 */

/**
 * Verify the current password and replace it with a hash of the new one.
 * Bumps password_it (via updatePassword), which revokes every other session
 * signed in on the account. Returns the new version so the caller can re-issue
 * tokens for the current session.
 * @param {string} userId - Authenticated user id (UUID).
 * @param {string} currentPassword - The user's existing password.
 * @param {string} newPassword - The password to switch to.
 * @returns {Promise<{user_id: string, password_it: number}>}
 * @throws {AppError} 400 missing fields / no password on account, 401 wrong
 *   current password, 404 user missing.
 */
async function changePassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new AppError(400, 'Current and new password are required');
  }
  const user = await userRepository.findById(userId);
  if (!user || !user.password_hash) {
    throw new AppError(400, 'Password changes require an existing password on the account');
  }
  const valid = await authService.verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'Current password is incorrect');
  }
  const passwordHash = await authService.hashPassword(newPassword);
  const updated = await userRepository.updatePassword(userId, passwordHash);
  if (!updated) throw new AppError(404, 'User not found');
  return { user_id: userId, password_it: updated.password_it };
}

module.exports = {
  changePassword,
};
