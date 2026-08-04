const pool = require('../db/pool');

/**
 * List all concepts on a board, verifying board ownership via JOIN.
 * Optionally filter to concepts carrying a specific tag.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string|null} tagId - Optional tag id (UUID) to filter by, or null.
 * @returns {Promise<Array<object>>} Concept rows.
 */
async function findAllByBoard(userId, boardId, tagId) {
  const result = await pool.query(
    `SELECT DISTINCT c.concept_id, c.board_id, c.prompt, c.answer, c.hint,
            c.times_answered_correctly, c.created_at, c.updated_at
     FROM concepts c
     JOIN boards b ON b.board_id = c.board_id
     LEFT JOIN concept_tags ct ON ct.concept_id = c.concept_id AND ct.tag_id = $3
     WHERE c.board_id = $1 AND b.user_id = $2
       AND ($3::uuid IS NULL OR ct.concept_id IS NOT NULL)
     ORDER BY c.created_at`,
    [boardId, userId, tagId]
  );
  return result.rows;
}

/**
 * Fetch one concept, verifying it belongs to the user's board via JOIN.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} conceptId - Concept id (UUID).
 * @returns {Promise<object|null>} Concept row or null.
 */
async function findById(userId, boardId, conceptId) {
  const result = await pool.query(
    `SELECT c.concept_id, c.board_id, c.prompt, c.answer, c.hint,
            c.times_answered_correctly, c.created_at, c.updated_at
     FROM concepts c
     JOIN boards b ON b.board_id = c.board_id
     WHERE c.concept_id = $1 AND c.board_id = $2 AND b.user_id = $3`,
    [conceptId, boardId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Insert a concept. The INSERT only proceeds if the board belongs to the
 * user (checked via SELECT FROM boards subquery), so a foreign board yields
 * no row and the caller gets null.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {{prompt: string, answer: string, hint: string|null}} data
 * @returns {Promise<object|null>} Created concept row, or null if board not owned.
 */
async function create(userId, boardId, { prompt, answer, hint }) {
  const result = await pool.query(
    `INSERT INTO concepts (board_id, prompt, answer, hint)
     SELECT $1, $2, $3, $4
     FROM boards b
     WHERE b.board_id = $1 AND b.user_id = $5
     RETURNING concept_id, board_id, prompt, answer, hint,
               times_answered_correctly, created_at, updated_at`,
    [boardId, prompt, answer, hint, userId]
  );
  return result.rows[0] || null;
}

/**
 * Update a concept's prompt, answer, and/or hint. Only provided fields
 * change; times_answered_correctly is intentionally not updatable here —
 * it is managed only by quiz runs. The UPDATE is joined through boards so it
 * cannot touch another user's concept.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} conceptId - Concept id (UUID).
 * @param {{prompt?: string, answer?: string, hint?: string|null}} changes
 * @returns {Promise<object|null>} Updated concept row or null.
 */
async function update(userId, boardId, conceptId, { prompt, answer, hint }) {
  const sets = [];
  const values = [];
  if (prompt !== undefined) {
    sets.push(`prompt = $${sets.length + 1}`);
    values.push(prompt);
  }
  if (answer !== undefined) {
    sets.push(`answer = $${sets.length + 1}`);
    values.push(answer);
  }
  if (hint !== undefined) {
    sets.push(`hint = $${sets.length + 1}`);
    values.push(hint);
  }
  if (sets.length === 0) return null;
  sets.push(`updated_at = now()`);
  values.push(conceptId, boardId, userId);
  const result = await pool.query(
    `UPDATE concepts c
     SET ${sets.join(', ')}
     FROM boards b
     WHERE c.concept_id = $${values.length - 2}
       AND c.board_id = b.board_id
       AND b.board_id = $${values.length - 1}
       AND b.user_id = $${values.length}
     RETURNING c.concept_id, c.board_id, c.prompt, c.answer, c.hint,
               c.times_answered_correctly, c.created_at, c.updated_at`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Delete a concept, joined through boards so only the owner's concept is
 * removed.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} conceptId - Concept id (UUID).
 * @returns {Promise<boolean>} True if a row was deleted.
 */
async function remove(userId, boardId, conceptId) {
  const result = await pool.query(
    `DELETE FROM concepts c
     USING boards b
     WHERE c.concept_id = $1
       AND c.board_id = b.board_id
       AND b.board_id = $2
       AND b.user_id = $3`,
    [conceptId, boardId, userId]
  );
  return result.rowCount > 0;
}

module.exports = {
  findAllByBoard,
  findById,
  create,
  update,
  remove,
};
