const pool = require('../db/pool');

/**
 * Password reset tokens. One row per user — a new request overwrites the
 * previous token (upsert on the unique user_id index), so a user can only ever
 * hold one live reset link. The token is a random hex string (PK); requested_at
 * backs the expiry check. Rows are deleted once the reset is consumed.
 */

/**
 * Create a reset row for a user, replacing any existing row for that user.
 * @param {string} userId - User id (UUID).
 * @param {string} token - Random hex token (primary key).
 * @returns {Promise<object>} The inserted row { token, user_id, requested_at }.
 */
async function upsert(userId, token) {
  const result = await pool.query(
    `INSERT INTO password_resets (token, user_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET token = EXCLUDED.token, requested_at = now()
     RETURNING token, user_id, requested_at`,
    [token, userId]
  );
  return result.rows[0];
}

/**
 * Resolve a reset token to its user and requested-at time.
 * @param {string} token - Random hex token.
 * @returns {Promise<object|null>} Row { token, user_id, requested_at }, or null.
 */
async function findByToken(token) {
  const result = await pool.query(
    'SELECT token, user_id, requested_at FROM password_resets WHERE token = $1',
    [token]
  );
  return result.rows[0] || null;
}

/**
 * Delete a consumed reset token. Called after a successful password change so
 * the token is single-use.
 * @param {string} token - Random hex token.
 * @returns {Promise<void>}
 */
async function deleteByToken(token) {
  await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);
}

module.exports = {
  upsert,
  findByToken,
  deleteByToken,
};
