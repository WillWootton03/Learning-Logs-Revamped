const userRepository = require('../repositories/userRepository');
const AppError = require('./AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FULL_NAME_LENGTH = 100;

/**
 * Basic email format check.
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

/**
 * Validate a full name: optional, but when present must be a non-empty
 * string of reasonable length. An explicitly-empty string clears the name.
 * @param {*} fullName
 * @returns {boolean}
 */
function validateFullName(fullName) {
  return (
    fullName === undefined ||
    fullName === null ||
    (typeof fullName === 'string' && fullName.trim().length <= MAX_FULL_NAME_LENGTH)
  );
}

/**
 * Remove the password_hash from a user record before it leaves the API.
 * Returns the display name (may be null until the user sets one) and the
 * join date, which the profile page shows. user_id is intentionally included
 * for the backend's internal use; the client drops it before storing anything.
 * @param {object|null} user - Raw DB row.
 * @returns {object|null} Safe user object or null.
 */
function stripHash(user) {
  if (!user) return null;
  return {
    user_id: user.user_id,
    email: user.email,
    full_name: user.full_name ?? null,
    email_verified: user.email_verified ?? false,
    created_at: user.created_at ?? null,
  };
}

/**
 * Fetch a single user by id. Throws 404 if they don't exist.
 * @param {string} id - User id (UUID).
 * @returns {Promise<object>} Safe user object.
 */
async function getById(id) {
  const user = await userRepository.findById(id);
  if (!user) throw new AppError(404, 'User not found');
  return stripHash(user);
}

/**
 * Create a new user after validating email and checking for duplicates.
 * @param {{email: string, fullName?: string|null, passwordHash: string|null, googleId: string|null}} data
 * @returns {Promise<{user_id: string, email: string, full_name: string|null}>}
 * @throws {AppError} 400 invalid email, 409 email already registered.
 */
async function create({ email, fullName = null, passwordHash, googleId }) {
  if (!validateEmail(email)) {
    throw new AppError(400, 'A valid email is required');
  }
  if (!validateFullName(fullName)) {
    throw new AppError(400, `Full name must be at most ${MAX_FULL_NAME_LENGTH} characters`);
  }
  if (await userRepository.findByEmail(email)) {
    throw new AppError(409, 'Email already in use');
  }
  const userId = await userRepository.create({
    email,
    fullName: typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null,
    passwordHash,
    googleId,
  });
  return { user_id: userId, email, full_name: fullName ?? null };
}

/**
 * Update a user's name and/or email. Only provided fields change; passing an
 * empty name string clears the stored display name. Password changes are
 * handled by passwordService.changePassword, not here.
 * @param {string} id - User id (UUID).
 * @param {{fullName?: string|null, email?: string}} changes
 * @returns {Promise<object>} Updated safe user object.
 * @throws {AppError} 400 invalid email/name, 404 user missing, 409 email taken.
 */
async function update(id, { fullName, email }) {
  if (email !== undefined && !validateEmail(email)) {
    throw new AppError(400, 'A valid email is required');
  }
  if (fullName !== undefined && !validateFullName(fullName)) {
    throw new AppError(400, `Full name must be at most ${MAX_FULL_NAME_LENGTH} characters`);
  }
  if (email !== undefined) {
    const existing = await userRepository.findByEmail(email);
    // Compare as strings — user_id is a UUID, not a number.
    if (existing && existing.user_id !== id) {
      throw new AppError(409, 'Email already in use');
    }
  }
  const userId = await userRepository.update(id, {
    fullName,
    email,
  });
  if (!userId) throw new AppError(404, 'User not found');
  const user = await userRepository.findById(id);
  return stripHash(user);
}

/**
 * Delete a user. Throws 404 if the id doesn't exist.
 * @param {string} id - User id (UUID).
 * @returns {Promise<{user_id: string}>}
 */
async function remove(id) {
  const deleted = await userRepository.remove(id);
  if (!deleted) throw new AppError(404, 'User not found');
  return { user_id: id };
}

module.exports = {
  getById,
  create,
  update,
  remove,
};
