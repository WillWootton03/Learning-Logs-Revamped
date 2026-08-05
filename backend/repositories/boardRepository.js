const pool = require('../db/pool');

/**
 * List every board owned by a user, with the aggregate counters the dashboard
 * cards need (concept counts, session count, last-used). Counters are scalar
 * subqueries keyed on indexed FKs, so no row-multiplication across joins.
 * @param {string} userId - Owner's user id (UUID).
 * @returns {Promise<Array<object>>} Board summary rows.
 */
async function findAllByUserId(userId) {
  const result = await pool.query(
    `SELECT
       b.board_id,
       b.name,
       b.subject,
       b.color,
       b.mastery_threshold,
       (SELECT COUNT(*) FROM concepts c WHERE c.board_id = b.board_id)::int AS concept_count,
       (SELECT COUNT(*) FROM concepts c WHERE c.board_id = b.board_id
          AND c.times_answered_correctly >= b.mastery_threshold)::int AS learned_count,
       (SELECT COUNT(*) FROM quiz q WHERE q.board_id = b.board_id)::int AS session_count,
       (SELECT MAX(q.created_at) FROM quiz q WHERE q.board_id = b.board_id) AS last_used_at
     FROM boards b
     WHERE b.user_id = $1
     ORDER BY b.created_at`,
    [userId]
  );
  return result.rows;
}

/**
 * Fetch one board, verifying the user owns it. Ownership is enforced in SQL
 * (defense in depth beyond route middleware). Detail queries return the full
 * row — but boards has no updated_at and created_at is never returned, so the
 * detail row is the summary plus mastery_threshold.
 * @param {string} userId - Owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<object|null>} Board row or null.
 */
async function findById(userId, boardId) {
  const result = await pool.query(
    'SELECT board_id, name, subject, color, mastery_threshold FROM boards WHERE board_id = $1 AND user_id = $2',
    [boardId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Insert a new board.
 * @param {{userId: string, name: string, subject: string, color: string, masteryThreshold: number}} data
 * @returns {Promise<object>} The created board row (summary columns).
 */
async function create({ userId, name, subject, color, masteryThreshold }) {
  const result = await pool.query(
    'INSERT INTO boards (user_id, name, subject, color, mastery_threshold) VALUES ($1, $2, $3, $4, $5) RETURNING board_id, name, subject, color',
    [userId, name, subject, color, masteryThreshold]
  );
  return result.rows[0];
}

/**
 * Update a board's name, subject, color, and/or mastery threshold. Only
 * provided fields change; the SET clause is built dynamically. Ownership is
 * verified in the WHERE clause.
 * @param {string} userId - Owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {{name?: string, subject?: string, color?: string, masteryThreshold?: number}} changes
 * @returns {Promise<object|null>} Updated board row or null.
 */
async function update(userId, boardId, { name, subject, color, masteryThreshold }) {
  const sets = [];
  const values = [];
  if (name !== undefined) {
    sets.push(`name = $${sets.length + 1}`);
    values.push(name);
  }
  if (subject !== undefined) {
    sets.push(`subject = $${sets.length + 1}`);
    values.push(subject);
  }
  if (color !== undefined) {
    sets.push(`color = $${sets.length + 1}`);
    values.push(color);
  }
  if (masteryThreshold !== undefined) {
    sets.push(`mastery_threshold = $${sets.length + 1}`);
    values.push(masteryThreshold);
  }
  if (sets.length === 0) return null;
  values.push(boardId, userId);
  const result = await pool.query(
    `UPDATE boards SET ${sets.join(', ')} WHERE board_id = $${values.length - 1} AND user_id = $${values.length} RETURNING board_id, name, subject, color, mastery_threshold`,
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
