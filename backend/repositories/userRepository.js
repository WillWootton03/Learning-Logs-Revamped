const { pool } = require('../db/pool');

/**
 * Look up a user by email. Used by password login, Google linking, and
 * duplicate checks. Includes password_hash so auth flows can verify
 * credentials, plus password_it for token versioning.
 * @param {string} email
 * @returns {Promise<object|null>} User row or null.
 */
async function findByEmail(email) {
  const result = await pool.query(
    'SELECT user_id, email, full_name, password_hash, google_id, email_verified, password_it FROM users WHERE email = $1',
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
    'SELECT user_id, email, full_name, password_hash, google_id, email_verified, password_it FROM users WHERE google_id = $1',
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
    'SELECT user_id, email, full_name, password_hash, google_id, email_verified, password_it, created_at FROM users WHERE user_id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Insert a new user. Email is unique, so a second insert with the same
 * email throws a Postgres 23505 duplicate-key error.
 * @param {{email: string, fullName: string|null, passwordHash: string|null, googleId: string|null}} data
 * @returns {Promise<number>} The new user's user_id.
 */
async function create({ email, fullName = null, passwordHash, googleId }) {
  const result = await pool.query(
    'INSERT INTO users (email, full_name, password_hash, google_id) VALUES ($1, $2, $3, $4) RETURNING user_id',
    [email, fullName, passwordHash, googleId]
  );
  return result.rows[0].user_id;
}

/**
 * Update a user's profile fields. Builds the SET clause from whichever
 * fields are provided, so an update can change only the name or only the
 * email. Changing the email also resets verification: the new address must be
 * confirmed with a fresh code before it can be used to log in again.
 * Password changes are intentionally NOT handled here — they go through
 * updatePassword() so credential writes stay on their own code path.
 * @param {number|string} id - User id.
 * @param {{fullName?: string|null, email?: string}} changes
 * @returns {Promise<number|null>} Updated user_id, or null if no fields/row.
 */
async function update(id, { fullName, email }) {
  const sets = [];
  const values = [];
  if (fullName !== undefined) {
    sets.push(`full_name = $${sets.length + 1}`);
    values.push(fullName);
  }
  if (email !== undefined) {
    sets.push(`email = $${sets.length + 1}`);
    values.push(email);
    // A new email means the address has never been confirmed — unverify it so
    // the login gate re-engages until the fresh code is validated.
    sets.push('email_verified = false');
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
 * Replace the user's password hash. Dedicated query for credential writes
 * (change-password + password-reset flows); never mixed into profile updates.
 * Bumps password_it so every token minted against the old version is revoked.
 * @param {number|string} id - User id.
 * @param {string} passwordHash - bcrypt hash of the new password.
 * @returns {Promise<object|null>} Row { user_id, password_it } (the incremented
 *   version), or null if no row.
 */
async function updatePassword(id, passwordHash) {
  const result = await pool.query(
    `UPDATE users SET password_hash = $2, password_it = password_it + 1
     WHERE user_id = $1 RETURNING user_id, password_it`,
    [id, passwordHash]
  );
  return result.rows[0] || null;
}

/**
 * Mark a user's email as verified. This is the only verification-related
 * write — tokens themselves are stateless and are never stored.
 * @param {number|string} id - User id.
 * @returns {Promise<void>}
 */
async function setEmailVerified(id) {
  await pool.query('UPDATE users SET email_verified = true WHERE user_id = $1', [id]);
}

/**
 * Attach a Google id to an existing account (used when a Google login
 * matches an email that was previously registered with a password). Also
 * back-fills the display name from Google's profile when the account has none.
 * @param {number|string} id - User id.
 * @param {string} googleId - Google's `sub` claim.
 * @param {string|null} [fullName] - Google's profile name, stored if unset.
 * @returns {Promise<number|null>} Updated user_id, or null if no row.
 */
async function linkGoogleId(id, googleId, fullName = null) {
  const result = await pool.query(
    `UPDATE users
     SET google_id = $1,
         full_name = CASE WHEN full_name IS NULL AND $3::text IS NOT NULL THEN $3 ELSE full_name END
     WHERE user_id = $2
     RETURNING user_id`,
    [googleId, id, fullName]
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
  updatePassword,
  remove,
  linkGoogleId,
  setEmailVerified,
};
