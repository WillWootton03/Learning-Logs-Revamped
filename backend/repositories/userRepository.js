const pool = require('../db/pool');

const COLUMNS = ['user_id', 'email', 'password_hash', 'google_id', 'created_at'];

/**
 * Look up a user by email. Used by password login and duplicate checks.
 * Includes password_hash so the caller can verify credentials.
 * @param {string} email
 * @returns {Promise<object|null>} User row or null.
 */
async function findByEmail(email) {
  const result = await pool.query(
    'SELECT user_id, email, password_hash, google_id FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Look up a user by their Google account id. Used by Google login.
 * @param {string} googleId - Google's `sub` claim.
 * @returns {Promise<object|null>} User row or null.
 */
async function findByGoogleId(googleId) {
  const result = await pool.query(
    'SELECT user_id, email, password_hash, google_id FROM users WHERE google_id = $1',
    [googleId]
  );
  return result.rows[0] || null;
}

/**
 * Look up a user by primary key.
 * @param {number|string} id - User id.
 * @returns {Promise<object|null>} User row or null.
 */
async function findById(id) {
  const result = await pool.query(
    'SELECT user_id, email, password_hash, google_id, created_at FROM users WHERE user_id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Insert a new user. Email is unique, so a second insert with the same
 * email throws a Postgres 23505 duplicate-key error.
 * @param {{email: string, passwordHash: string|null, googleId: string|null}} data
 * @returns {Promise<number>} The new user's user_id.
 */
async function create({ email, passwordHash, googleId }) {
  const result = await pool.query(
    'INSERT INTO users (email, password_hash, google_id) VALUES ($1, $2, $3) RETURNING user_id',
    [email, passwordHash, googleId]
  );
  return result.rows[0].user_id;
}

/**
 * Update a user. Builds the SET clause from whichever fields are provided,
 * so an update can change only the email or only the password.
 * @param {number|string} id - User id.
 * @param {{email?: string, passwordHash?: string}} changes
 * @returns {Promise<number|null>} Updated user_id, or null if no fields/row.
 */
async function update(id, { email, passwordHash }) {
  const sets = [];
  const values = [];
  if (email !== undefined) {
    sets.push(`email = $${sets.length + 1}`);
    values.push(email);
  }
  if (passwordHash !== undefined) {
    sets.push(`password_hash = $${sets.length + 1}`);
    values.push(passwordHash);
  }
  if (sets.length === 0) return null;
  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE user_id = $${values.length} RETURNING user_id`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Attach a Google id to an existing account (used when a Google login
 * matches an email that was previously registered with a password).
 * @param {number|string} id - User id.
 * @param {string} googleId - Google's `sub` claim.
 * @returns {Promise<number|null>} Updated user_id, or null if no row.
 */
async function linkGoogleId(id, googleId) {
  const result = await pool.query(
    'UPDATE users SET google_id = $1 WHERE user_id = $2 RETURNING user_id',
    [googleId, id]
  );
  return result.rows[0] || null;
}

/**
 * Delete a user by id.
 * @param {number|string} id - User id.
 * @returns {Promise<boolean>} True if a row was deleted.
 */
async function remove(id) {
  const result = await pool.query('DELETE FROM users WHERE user_id = $1', [id]);
  return result.rowCount > 0;
}

module.exports = {
  findByEmail,
  findByGoogleId,
  findById,
  create,
  update,
  remove,
  linkGoogleId,
};
