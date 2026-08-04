const pool = require('../db/pool');

/**
 * List every board owned by a user.
 * @param {string} userId - Owner's user id (UUID).
 * @returns {Promise<Array<object>>} Board rows.
 */
async function findAllByUserId(userId) {
  const result = await pool.query(
    'SELECT board_id, name, created_at FROM boards WHERE user_id = $1 ORDER BY created_at',
    [userId]
  );
  return result.rows;
}

/**
 * Fetch one board, verifying the user owns it. Ownership is enforced in SQL
 * (defense in depth beyond route middleware).
 * @param {string} userId - Owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<object|null>} Board row or null.
 */
async function findById(userId, boardId) {
  const result = await pool.query(
    'SELECT board_id, name, mastery_threshold, created_at FROM boards WHERE board_id = $1 AND user_id = $2',
    [boardId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Insert a new board.
 * @param {{userId: string, name: string, masteryThreshold: number}} data
 * @returns {Promise<object>} The created board row.
 */
async function create({ userId, name, masteryThreshold }) {
  const result = await pool.query(
    'INSERT INTO boards (user_id, name, mastery_threshold) VALUES ($1, $2, $3) RETURNING board_id, name, created_at',
    [userId, name, masteryThreshold]
  );
  return result.rows[0];
}

/**
 * Update a board's name and/or mastery threshold. Only provided fields change;
 * the SET clause is built dynamically. Ownership verified in the WHERE clause.
 * @param {string} userId - Owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {{name?: string, masteryThreshold?: number}} changes
 * @returns {Promise<object|null>} Updated board row or null.
 */
async function update(userId, boardId, { name, masteryThreshold }) {
  const sets = [];
  const values = [];
  if (name !== undefined) {
    sets.push(`name = $${sets.length + 1}`);
    values.push(name);
  }
  if (masteryThreshold !== undefined) {
    sets.push(`mastery_threshold = $${sets.length + 1}`);
    values.push(masteryThreshold);
  }
  if (sets.length === 0) return null;
  values.push(boardId, userId);
  const result = await pool.query(
    `UPDATE boards SET ${sets.join(', ')} WHERE board_id = $${values.length - 1} AND user_id = $${values.length} RETURNING board_id, name, mastery_threshold`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a board, verifying ownership.
 * @param {string} userId - Owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<boolean>} True if a row was deleted.
 */
async function remove(userId, boardId) {
  const result = await pool.query(
    'DELETE FROM boards WHERE board_id = $1 AND user_id = $2',
    [boardId, userId]
  );
  return result.rowCount > 0;
}

module.exports = {
  findAllByUserId,
  findById,
  create,
  update,
  remove,
};
