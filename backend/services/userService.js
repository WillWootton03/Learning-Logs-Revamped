const userRepository = require('../repositories/userRepository');
const AppError = require('./AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Basic email format check.
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

/**
 * Remove the password_hash from a user record before it leaves the API.
 * Only user_id and email are ever returned to the client.
 * @param {object|null} user - Raw DB row.
 * @returns {object|null} Safe user object or null.
 */
function stripHash(user) {
  if (!user) return null;
  return { user_id: user.user_id, email: user.email };
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
 * @param {{email: string, passwordHash: string|null, googleId: string|null}} data
 * @returns {Promise<{user_id: string, email: string}>}
 * @throws {AppError} 400 invalid email, 409 email already registered.
 */
async function create({ email, passwordHash, googleId }) {
  if (!validateEmail(email)) {
    throw new AppError(400, 'A valid email is required');
  }
  if (await userRepository.findByEmail(email)) {
    throw new AppError(409, 'Email already in use');
  }
  const userId = await userRepository.create({ email, passwordHash, googleId });
  return { user_id: userId, email };
}

/**
 * Update a user's email and/or password hash. Only provided fields change.
 * @param {string} id - User id (UUID).
 * @param {{email?: string, passwordHash?: string}} changes
 * @returns {Promise<object>} Updated safe user object.
 * @throws {AppError} 400 invalid email, 404 user missing, 409 email taken.
 */
async function update(id, { email, passwordHash }) {
  if (email !== undefined && !validateEmail(email)) {
    throw new AppError(400, 'A valid email is required');
  }
  if (email !== undefined) {
    const existing = await userRepository.findByEmail(email);
    // Compare as strings — user_id is a UUID, not a number.
    if (existing && existing.user_id !== id) {
      throw new AppError(409, 'Email already in use');
    }
  }
  const userId = await userRepository.update(id, { email, passwordHash });
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
