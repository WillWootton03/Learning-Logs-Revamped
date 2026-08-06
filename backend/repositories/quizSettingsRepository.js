const pool = require('../db/pool');

// Detail queries return the full row; list queries stay lean (no board_id,
// no timestamps — those are redundant on a board-scoped list). All columns are
// aliased through quiz_settings so they're unambiguous against the boards JOIN
// (both tables have a `name` column).
const SETTINGS_COLUMNS = 'qs.quiz_settings_id, qs.name, qs.style, qs.include_known';
const DETAILED_SETTINGS_COLUMNS =
  'qs.quiz_settings_id, qs.board_id, qs.name, qs.style, qs.include_known, qs.updated_at';
// INSERT ... RETURNING has no FROM join, so the target table's columns are
// referenced unqualified (the INSERT target has no alias).
const INSERT_RETURNING_COLUMNS = 'quiz_settings_id, name, style, include_known';

/**
 * List all quiz settings on a board, verifying board ownership via JOIN.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<Array<object>>} Settings rows.
 */
async function findAllByBoard(userId, boardId) {
  const result = await pool.query(
    `SELECT ${SETTINGS_COLUMNS}
     FROM quiz_settings qs
     JOIN boards b ON b.board_id = qs.board_id
     WHERE qs.board_id = $1 AND b.user_id = $2
     ORDER BY qs.name`,
    [boardId, userId]
  );
  return result.rows;
}

/**
 * Fetch one quiz setting, verifying it belongs to the user's board.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} quizSettingsId - Settings id (UUID).
 * @returns {Promise<object|null>} Settings row or null.
 */
async function findById(userId, boardId, quizSettingsId) {
  const result = await pool.query(
    `SELECT ${DETAILED_SETTINGS_COLUMNS}
     FROM quiz_settings qs
     JOIN boards b ON b.board_id = qs.board_id
     WHERE qs.quiz_settings_id = $1 AND qs.board_id = $2 AND b.user_id = $3`,
    [quizSettingsId, boardId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Insert quiz settings. Only proceeds if the board belongs to the user.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {{name: string, style: string, includeKnown: boolean}} data
 * @returns {Promise<object|null>} Created settings row, or null if not owned.
 */
async function create(userId, boardId, { name, style, includeKnown }) {
  const result = await pool.query(
    `INSERT INTO quiz_settings (board_id, name, style, include_known)
     SELECT $1, $2, $3, $4
     FROM boards b
     WHERE b.board_id = $1 AND b.user_id = $5
     RETURNING ${INSERT_RETURNING_COLUMNS}`,
    [boardId, name, style, includeKnown, userId]
  );
  return result.rows[0] || null;
}

/**
 * Update a setting's name, style, and/or include_known. Only provided fields
 * change; the SET clause is built dynamically. Ownership verified in WHERE.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} quizSettingsId - Settings id (UUID).
 * @param {{name?: string, style?: string, includeKnown?: boolean}} changes
 * @returns {Promise<object|null>} Updated settings row or null.
 */
async function update(userId, boardId, quizSettingsId, { name, style, includeKnown }) {
  // Identity params go first ($1 = quizSettingsId, $2 = boardId, $3 = userId)
  // so the WHERE clause positions are fixed; mutable fields follow in order.
  const values = [quizSettingsId, boardId, userId];
  const sets = [];
  let param = 4;
  if (name !== undefined) {
    sets.push(`name = $${param}`);
    values.push(name);
    param += 1;
  }
  if (style !== undefined) {
    sets.push(`style = $${param}`);
    values.push(style);
    param += 1;
  }
  if (includeKnown !== undefined) {
    sets.push(`include_known = $${param}`);
    values.push(includeKnown);
    param += 1;
  }
  if (sets.length === 0) return null;
  sets.push(`updated_at = now()`);
  const result = await pool.query(
    `UPDATE quiz_settings qs
     SET ${sets.join(', ')}
     FROM boards b
     WHERE qs.quiz_settings_id = $1
       AND qs.board_id = b.board_id
       AND b.board_id = $2
       AND b.user_id = $3
     RETURNING ${SETTINGS_COLUMNS}`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete quiz settings, joined through boards so only the owner's row is
 * removed. ON DELETE CASCADE cleans up quiz_settings_tags.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} quizSettingsId - Settings id (UUID).
 * @returns {Promise<boolean>} True if a row was deleted.
 */
async function remove(userId, boardId, quizSettingsId) {
  const result = await pool.query(
    `DELETE FROM quiz_settings qs
     USING boards b
     WHERE qs.quiz_settings_id = $1
       AND qs.board_id = b.board_id
       AND b.board_id = $2
       AND b.user_id = $3`,
    [quizSettingsId, boardId, userId]
  );
  return result.rowCount > 0;
}

/**
 * List the tag ids linked to a quiz setting.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} quizSettingsId - Settings id (UUID).
 * @returns {Promise<string[]>} Tag ids.
 */
async function findTagIds(userId, boardId, quizSettingsId) {
  const result = await pool.query(
    `SELECT qst.tag_id
     FROM quiz_settings_tags qst
     JOIN quiz_settings qs ON qs.quiz_settings_id = qst.quiz_settings_id
     JOIN boards b ON b.board_id = qs.board_id
     WHERE qst.quiz_settings_id = $1 AND qs.board_id = $2 AND b.user_id = $3
     ORDER BY qst.tag_id`,
    [quizSettingsId, boardId, userId]
  );
  return result.rows.map((row) => row.tag_id);
}

/**
 * Link a batch of tags to a quiz setting. Already-linked tags are no-ops
 * (ON CONFLICT DO NOTHING). Single batched INSERT, no transaction needed.
 * @param {string} quizSettingsId - Settings id (UUID).
 * @param {string[]} tagIds - Tag ids to link.
 * @returns {Promise<void>}
 */
async function addTags(quizSettingsId, tagIds) {
  if (tagIds.length === 0) return;
  // quizSettingsId is the same for every row, so it's bound once ($1) and the
  // tag ids are expanded with unnest rather than repeated per tuple.
  await pool.query(
    `INSERT INTO quiz_settings_tags (quiz_settings_id, tag_id)
     SELECT $1, unnest($2::uuid[])
     ON CONFLICT (quiz_settings_id, tag_id) DO NOTHING`,
    [quizSettingsId, tagIds]
  );
}

/**
 * Unlink a batch of tags from a quiz setting. Non-existent links are no-ops.
 * @param {string} quizSettingsId - Settings id (UUID).
 * @param {string[]} tagIds - Tag ids to unlink.
 * @returns {Promise<number>} Number of links deleted.
 */
async function removeTags(quizSettingsId, tagIds) {
  if (tagIds.length === 0) return 0;
  const result = await pool.query(
    `DELETE FROM quiz_settings_tags
     WHERE quiz_settings_id = $1 AND tag_id = ANY($2::uuid[])`,
    [quizSettingsId, tagIds]
  );
  return result.rowCount;
}

module.exports = {
  findAllByBoard,
  findById,
  create,
  update,
  remove,
  findTagIds,
  addTags,
  removeTags,
};
