const pool = require('../db/pool');

/**
 * List all concepts on a board, verifying board ownership via JOIN.
 * Optionally filter to concepts carrying a specific tag. Each row carries its
 * tag names (aggregated, one round trip) so the board page can render tags
 * without an extra query per concept.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string|null} tagId - Optional tag id (UUID) to filter by, or null.
 * @returns {Promise<Array<object>>} Concept rows.
 */
async function findAllByBoard(userId, boardId, tagId) {
  const result = await pool.query(
    `SELECT c.concept_id, c.prompt, c.answer, c.times_answered_correctly,
            COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.tag_id IS NOT NULL), '{}') AS tags
     FROM concepts c
     JOIN boards b ON b.board_id = c.board_id
     LEFT JOIN concept_tags ct ON ct.concept_id = c.concept_id
     LEFT JOIN tags t ON t.tag_id = ct.tag_id
     WHERE c.board_id = $1 AND b.user_id = $2
       AND ($3::uuid IS NULL OR EXISTS (
         SELECT 1 FROM concept_tags f WHERE f.concept_id = c.concept_id AND f.tag_id = $3
       ))
     GROUP BY c.concept_id, c.prompt, c.answer, c.times_answered_correctly
     ORDER BY c.created_at`,
    [boardId, userId, tagId]
  );
  return result.rows;
}

/**
 * Fetch one concept, verifying it belongs to the user's board via JOIN.
 * Detail queries return the full row (including hint and updated_at) —
 * only get-by-id returns these columns.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} conceptId - Concept id (UUID).
 * @returns {Promise<object|null>} Concept row or null.
 */
async function findById(userId, boardId, conceptId) {
  const result = await pool.query(
    `SELECT c.concept_id, c.board_id, c.prompt, c.answer, c.hint,
            c.times_answered_correctly, c.updated_at
     FROM concepts c
     JOIN boards b ON b.board_id = c.board_id
     WHERE c.concept_id = $1 AND c.board_id = $2 AND b.user_id = $3`,
    [conceptId, boardId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Fetch many concepts by id in one query, verifying they all belong to the
 * user's board. Used by the quiz engine to validate submitted questions and
 * fetch their answers for scoring.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string[]} conceptIds - Concept ids (UUIDs).
 * @returns {Promise<Array<object>>} Concept rows (may be fewer than requested
 *   if some ids don't belong to this board).
 */
async function findManyByIds(userId, boardId, conceptIds) {
  if (conceptIds.length === 0) return [];
  const result = await pool.query(
    `SELECT c.concept_id, c.prompt, c.answer, c.times_answered_correctly
     FROM concepts c
     JOIN boards b ON b.board_id = c.board_id
     WHERE c.concept_id = ANY($1::uuid[]) AND c.board_id = $2 AND b.user_id = $3`,
    [conceptIds, boardId, userId]
  );
  return result.rows;
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
     RETURNING concept_id, prompt, answer, times_answered_correctly`,
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
  // Identity params go first ($1 = conceptId, $2 = boardId, $3 = userId) so
  // the WHERE clause positions are fixed; mutable fields follow in order.
  const values = [conceptId, boardId, userId];
  const sets = [];
  let param = 4;
  if (prompt !== undefined) {
    sets.push(`prompt = $${param}`);
    values.push(prompt);
    param += 1;
  }
  if (answer !== undefined) {
    sets.push(`answer = $${param}`);
    values.push(answer);
    param += 1;
  }
  if (hint !== undefined) {
    sets.push(`hint = $${param}`);
    values.push(hint);
    param += 1;
  }
  if (sets.length === 0) return null;
  sets.push(`updated_at = now()`);
  const result = await pool.query(
    `UPDATE concepts c
     SET ${sets.join(', ')}
     FROM boards b
     WHERE c.concept_id = $1
       AND c.board_id = b.board_id
       AND b.board_id = $2
       AND b.user_id = $3
     RETURNING c.concept_id, c.prompt, c.answer, c.times_answered_correctly`,
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
  findManyByIds,
  create,
  update,
  remove,
};
