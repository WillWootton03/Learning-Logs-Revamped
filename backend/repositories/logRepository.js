const pool = require('../db/pool');

/**
 * List all logs on a board, verifying board ownership via JOIN.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<Array<object>>} Log rows.
 */
async function findAllByBoard(userId, boardId) {
  const result = await pool.query(
    `SELECT l.log_id, l.title, l.content, l.updated_at
     FROM logs l
     JOIN boards b ON b.board_id = l.board_id
     WHERE l.board_id = $1 AND b.user_id = $2
     ORDER BY l.updated_at DESC`,
    [boardId, userId]
  );
  return result.rows;
}

/**
 * Fetch one log, verifying it belongs to the user's board via JOIN.
 * Detail queries return the full row (including updated_at) — only
 * get-by-id returns these columns.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} logId - Log id (UUID).
 * @returns {Promise<object|null>} Log row or null.
 */
async function findById(userId, boardId, logId) {
  const result = await pool.query(
    `SELECT l.log_id, l.board_id, l.title, l.content, l.updated_at
     FROM logs l
     JOIN boards b ON b.board_id = l.board_id
     WHERE l.log_id = $1 AND l.board_id = $2 AND b.user_id = $3`,
    [logId, boardId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Insert a log. The INSERT only proceeds if the board belongs to the user
 * (checked via a SELECT FROM boards subquery in the same statement), so a
 * foreign board yields no row and the caller gets null.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {{title: string, content: string}} data
 * @returns {Promise<object|null>} Created log row, or null if board not owned.
 */
async function create(userId, boardId, { title, content }) {
  const result = await pool.query(
    `INSERT INTO logs (board_id, title, content)
     SELECT $1, $2, $3
     FROM boards b
     WHERE b.board_id = $1 AND b.user_id = $4
     RETURNING log_id, title, content, updated_at`,
    [boardId, title, content, userId]
  );
  return result.rows[0] || null;
}

/**
 * Update a log's title and/or content. Only provided fields change. The
 * UPDATE is joined through boards so it cannot touch another user's log.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} logId - Log id (UUID).
 * @param {{title?: string, content?: string}} changes
 * @returns {Promise<object|null>} Updated log row or null.
 */
async function update(userId, boardId, logId, { title, content }) {
  // Identity params go first ($1 = logId, $2 = boardId, $3 = userId) so the
  // WHERE clause positions are fixed; mutable fields follow in order.
  const values = [logId, boardId, userId];
  const sets = [];
  let param = 4;
  if (title !== undefined) {
    sets.push(`title = $${param}`);
    values.push(title);
    param += 1;
  }
  if (content !== undefined) {
    sets.push(`content = $${param}`);
    values.push(content);
    param += 1;
  }
  if (sets.length === 0) return null;
  sets.push(`updated_at = now()`);
  const result = await pool.query(
    `UPDATE logs l
     SET ${sets.join(', ')}
     FROM boards b
     WHERE l.log_id = $1
       AND l.board_id = b.board_id
       AND b.board_id = $2
       AND b.user_id = $3
     RETURNING l.log_id, l.title, l.content, l.updated_at`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a log, joined through boards so only the owner's log is removed.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} logId - Log id (UUID).
 * @returns {Promise<boolean>} True if a row was deleted.
 */
async function remove(userId, boardId, logId) {
  const result = await pool.query(
    `DELETE FROM logs l
     USING boards b
     WHERE l.log_id = $1
       AND l.board_id = b.board_id
       AND b.board_id = $2
       AND b.user_id = $3`,
    [logId, boardId, userId]
  );
  return result.rowCount > 0;
}

/**
 * Delete every log on a board, joined through boards so only the owner's
 * logs are removed.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<number>} Number of logs deleted.
 */
async function removeAll(userId, boardId) {
  const result = await pool.query(
    `DELETE FROM logs l
     USING boards b
     WHERE l.board_id = b.board_id
       AND b.board_id = $1
       AND b.user_id = $2`,
    [boardId, userId]
  );
  return result.rowCount;
}

module.exports = {
  findAllByBoard,
  findById,
  create,
  update,
  remove,
  removeAll,
};
