const pool = require('../db/pool');

/**
 * List all tags on a board, verifying board ownership via JOIN.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<Array<object>>} Tag rows.
 */
async function findAllByBoard(userId, boardId) {
  const result = await pool.query(
    `SELECT t.tag_id, t.name
     FROM tags t
     JOIN boards b ON b.board_id = t.board_id
     WHERE t.board_id = $1 AND b.user_id = $2
     ORDER BY t.name`,
    [boardId, userId]
  );
  return result.rows;
}

/**
 * Fetch one tag, verifying it belongs to the user's board via JOIN.
 * Detail queries return the full row — but tags has no updated_at and
 * created_at is never returned, so the detail row has no timestamp.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} tagId - Tag id (UUID).
 * @returns {Promise<object|null>} Tag row or null.
 */
async function findById(userId, boardId, tagId) {
  const result = await pool.query(
    `SELECT t.tag_id, t.board_id, t.name
     FROM tags t
     JOIN boards b ON b.board_id = t.board_id
     WHERE t.tag_id = $1 AND t.board_id = $2 AND b.user_id = $3`,
    [tagId, boardId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Fetch many tags by id in one query, verifying they all belong to the user's
 * board. Only owned tags are returned, so the caller can detect any foreign
 * or fake ids by comparing lengths. Used to validate tag filters in one round
 * trip instead of one query per tag.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string[]} tagIds - Tag ids (UUIDs) to look up.
 * @returns {Promise<Array<object>>} Tag rows belonging to the board.
 */
async function findByIds(userId, boardId, tagIds) {
  if (tagIds.length === 0) return [];
  const result = await pool.query(
    `SELECT t.tag_id, t.name
     FROM tags t
     JOIN boards b ON b.board_id = t.board_id
     WHERE t.tag_id = ANY($1::uuid[]) AND t.board_id = $2 AND b.user_id = $3`,
    [tagIds, boardId, userId]
  );
  return result.rows;
}

/**
 * Look up a tag by name within a board (used for uniqueness checks).
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} name - Tag name.
 * @returns {Promise<object|null>} Tag row or null.
 */
async function findByName(userId, boardId, name) {
  const result = await pool.query(
    `SELECT t.tag_id, t.name 
     FROM tags t
     JOIN boards b ON b.board_id = t.board_id
     WHERE t.board_id = $1 AND t.name = $2 AND b.user_id = $3`,
    [boardId, name, userId]
  );
  return result.rows[0] || null;
}

/**
 * Insert a tag. Only proceeds if the board belongs to the user.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {{name: string}} data
 * @returns {Promise<object|null>} Created tag row, or null if board not owned.
 */
async function create(userId, boardId, { name }) {
  const result = await pool.query(
    `INSERT INTO tags (board_id, name)
     SELECT $1, $2
     FROM boards b
     WHERE b.board_id = $1 AND b.user_id = $3
     RETURNING tag_id, name `,
    [boardId, name, userId]
  );
  return result.rows[0] || null;
}

/**
 * Insert many tags on a board in one statement. Names that already exist on
 * the board (UNIQUE board_id+name) are skipped, so re-submitting a batch is
 * idempotent. Ownership is enforced by joining to boards — a foreign board
 * yields no rows.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string[]} names - Tag names to create.
 * @returns {Promise<Array<object>>} Created tag rows (existing names excluded).
 */
async function createMany(userId, boardId, names) {
  if (names.length === 0) return [];
  const result = await pool.query(
    `INSERT INTO tags (board_id, name)
     SELECT b.board_id, input.name
     FROM unnest($2::text[]) AS input(name)
     JOIN boards b ON b.board_id = $1 AND b.user_id = $3
     ON CONFLICT (board_id, name) DO NOTHING
     RETURNING tag_id, name`,
    [boardId, names, userId]
  );
  return result.rows;
}

/**
 * Link many tags to a concept in one statement. Only tags on the same,
 * user-owned board as the concept are linked (verified via joins); links that
 * already exist are no-ops (composite PK + ON CONFLICT DO NOTHING).
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} conceptId - Concept id (UUID).
 * @param {string[]} tagIds - Tag ids (UUIDs) to link.
 * @returns {Promise<Array<object>>} {concept_id, tag_id} rows actually linked.
 */
async function linkMany(userId, boardId, conceptId, tagIds) {
  if (tagIds.length === 0) return [];
  const result = await pool.query(
    `INSERT INTO concept_tags (concept_id, tag_id)
     SELECT c.concept_id, t.tag_id
     FROM concepts c
     JOIN boards b ON b.board_id = c.board_id AND b.user_id = $4
     JOIN tags t ON t.tag_id = ANY($3::uuid[]) AND t.board_id = $2
     WHERE c.concept_id = $1 AND c.board_id = $2
     ON CONFLICT (concept_id, tag_id) DO NOTHING
     RETURNING concept_id, tag_id`,
    [conceptId, boardId, tagIds, userId]
  );
  return result.rows;
}

/**
 * Rename a tag, joined through boards so only the owner's tag changes.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} tagId - Tag id (UUID).
 * @param {{name: string}} changes
 * @returns {Promise<object|null>} Updated tag row or null.
 */
async function update(userId, boardId, tagId, { name }) {
  const result = await pool.query(
    `UPDATE tags t
     SET name = $1
     FROM boards b
     WHERE t.tag_id = $2
       AND t.board_id = b.board_id
       AND b.board_id = $3
       AND b.user_id = $4
     RETURNING t.tag_id, t.name`,
    [name, tagId, boardId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Delete a tag, joined through boards so only the owner's tag is removed.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} tagId - Tag id (UUID).
 * @returns {Promise<boolean>} True if a row was deleted.
 */
async function remove(userId, boardId, tagId) {
  const result = await pool.query(
    `DELETE FROM tags t
     USING boards b
     WHERE t.tag_id = $1
       AND t.board_id = b.board_id
       AND b.board_id = $2
       AND b.user_id = $3`,
    [tagId, boardId, userId]
  );
  return result.rowCount > 0;
}

/**
 * Link a tag to a concept. Both must belong to the same, user-owned board.
 * The INSERT only proceeds when concept + tag are verified against the board;
 * an existing link is a no-op (ON CONFLICT DO NOTHING) and returns null.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} conceptId - Concept id (UUID).
 * @param {string} tagId - Tag id (UUID).
 * @returns {Promise<object|null>} {concept_id, tag_id} or null if already linked.
 */
async function linkConcept(userId, boardId, conceptId, tagId) {
  const result = await pool.query(
    `INSERT INTO concept_tags (concept_id, tag_id)
     SELECT c.concept_id, t.tag_id
     FROM concepts c
     JOIN tags t ON t.tag_id = $3 AND t.board_id = $2
     JOIN boards b ON b.board_id = c.board_id AND b.user_id = $4
     WHERE c.concept_id = $1 AND c.board_id = $2 AND t.board_id = $2
     ON CONFLICT (concept_id, tag_id) DO NOTHING
     RETURNING concept_id, tag_id`,
    [conceptId, boardId, tagId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Unlink a tag from a concept, joined through boards so it only applies to
 * the user's own board.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} conceptId - Concept id (UUID).
 * @param {string} tagId - Tag id (UUID).
 * @returns {Promise<boolean>} True if a link was deleted.
 */
async function unlinkConcept(userId, boardId, conceptId, tagId) {
  const result = await pool.query(
    `DELETE FROM concept_tags ct
     USING concepts c, tags t, boards b
     WHERE ct.concept_id = c.concept_id
       AND ct.tag_id = t.tag_id
       AND c.board_id = b.board_id
       AND b.user_id = $1
       AND c.concept_id = $2
       AND c.board_id = $3
       AND t.tag_id = $4
       AND t.board_id = $3`,
    [userId, conceptId, boardId, tagId]
  );
  return result.rowCount > 0;
}

/**
 * List the tags attached to a concept.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} conceptId - Concept id (UUID).
 * @returns {Promise<Array<object>>} Tag rows.
 */
async function findByConcept(userId, boardId, conceptId) {
  const result = await pool.query(
    `SELECT t.tag_id, t.name
     FROM concept_tags ct
     JOIN tags t ON t.tag_id = ct.tag_id
     JOIN concepts c ON c.concept_id = ct.concept_id
     JOIN boards b ON b.board_id = c.board_id
     WHERE ct.concept_id = $1 AND c.board_id = $2 AND b.user_id = $3
     ORDER BY t.name`,
    [conceptId, boardId, userId]
  );
  return result.rows;
}

/**
 * Delete every tag on a board, joined through boards so only the owner's
 * tags are removed. concept_tags and quiz_settings_tags cascade.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<number>} Number of tags deleted.
 */
async function removeAll(userId, boardId) {
  const result = await pool.query(
    `DELETE FROM tags t
     USING boards b
     WHERE t.board_id = b.board_id
       AND b.board_id = $1
       AND b.user_id = $2`,
    [boardId, userId]
  );
  return result.rowCount;
}

module.exports = {
  findAllByBoard,
  findById,
  findByIds,
  findByName,
  create,
  createMany,
  update,
  remove,
  linkConcept,
  linkMany,
  unlinkConcept,
  findByConcept,
  removeAll,
};
