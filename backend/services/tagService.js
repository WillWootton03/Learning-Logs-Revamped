const tagRepository = require('../repositories/tagRepository');
const conceptRepository = require('../repositories/conceptRepository');
const cache = require('./cache');
const AppError = require('./AppError');
const { isUuid } = require('../utils/validate');

const MAX_NAME_LENGTH = 50;

/**
 * Validate a tag name: required, non-empty, max 50 chars.
 * @param {*} name
 * @returns {boolean}
 */
function validateName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;
}

/**
 * Validate a board-scoped id param is a well-formed UUID.
 * @param {*} id
 * @returns {boolean}
 */
function validateId(id) {
  return typeof id === 'string' && isUuid(id);
}

/**
 * List all tags on a board the user owns. Served from the 30-minute Redis
 * cache; a miss hits Postgres and repopulates.
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<Array<object>>}
 */
async function list(userId, boardId) {
  const key = cache.boardKey(userId, boardId, 'tags');
  const cached = await cache.getJSON(key);
  if (cached) return cached;
  const rows = await tagRepository.findAllByBoard(userId, boardId);
  await cache.setJSON(key, rows);
  return rows;
}

/**
 * Fetch one tag, verifying the user owns its board.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} tagId
 * @returns {Promise<object>}
 * @throws {AppError} 404 if tag or board is missing/foreign.
 */
async function getById(userId, boardId, tagId) {
  const tag = await tagRepository.findById(userId, boardId, tagId);
  if (!tag) throw new AppError(404, 'Tag not found');
  return tag;
}

/**
 * Create a tag on a board the user owns. Tag names are unique per board.
 * @param {string} userId
 * @param {string} boardId
 * @param {{name: string}} data
 * @returns {Promise<object>}
 * @throws {AppError} 400 on invalid name, 409 duplicate name, 404 board missing.
 */
async function create(userId, boardId, { name }) {
  if (!validateName(name)) {
    throw new AppError(400, `Tag name is required (max ${MAX_NAME_LENGTH} characters)`);
  }
  const trimmed = name.trim();
  if (await tagRepository.findByName(userId, boardId, trimmed)) {
    throw new AppError(409, 'A tag with that name already exists on this board');
  }
  const tag = await tagRepository.create(userId, boardId, { name: trimmed });
  if (!tag) throw new AppError(404, 'Board not found');
  await cache.invalidateBoard(userId, boardId);
  return tag;
}

/**
 * Batch-create tags on a board. Names are trimmed and de-duplicated; names
 * that already exist on the board are skipped (idempotent), so the returned
 * rows are only the newly created tags.
 * @param {string} userId
 * @param {string} boardId
 * @param {*} names - Array of tag name strings.
 * @returns {Promise<Array<object>>} Newly created tag rows.
 * @throws {AppError} 400 on a non-array payload or any invalid name.
 */
async function createMany(userId, boardId, names) {
  if (names === undefined || names === null || !Array.isArray(names)) {
    throw new AppError(400, 'names must be an array of strings');
  }
  const unique = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 0))];
  if (unique.length === 0) {
    throw new AppError(400, 'Provide at least one valid tag name');
  }
  for (const name of unique) {
    if (!validateName(name)) {
      throw new AppError(400, `Tag names must be non-empty strings (max ${MAX_NAME_LENGTH} characters)`);
    }
  }
  const created = await tagRepository.createMany(userId, boardId, unique);
  await cache.invalidateBoard(userId, boardId);
  return created;
}

/**
 * Batch-link tags to a concept. Every id is validated in one query to exist
 * on the user's board; already-linked pairs are no-ops.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} conceptId
 * @param {*} tagIds - Array of tag id (UUID) strings.
 * @returns {Promise<{concept_id: string, tag_ids: string[]}>}
 * @throws {AppError} 400 on malformed/foreign ids, 404 if concept missing.
 */
async function linkMany(userId, boardId, conceptId, tagIds) {
  if (tagIds === undefined || tagIds === null || !Array.isArray(tagIds)) {
    throw new AppError(400, 'tagIds must be an array of UUIDs');
  }
  const unique = [...new Set(tagIds)];
  for (const id of unique) {
    if (!isUuid(id)) {
      throw new AppError(400, 'tagIds must contain valid UUIDs');
    }
  }
  const concept = await conceptRepository.findById(userId, boardId, conceptId);
  if (!concept) throw new AppError(404, 'Concept not found');
  // One batch query verifies every id belongs to this board.
  const found = await tagRepository.findByIds(userId, boardId, unique);
  if (found.length !== unique.length) {
    throw new AppError(400, 'One or more tags do not exist on this board');
  }
  await tagRepository.linkMany(userId, boardId, conceptId, unique);
  await cache.invalidateBoard(userId, boardId);
  return { concept_id: conceptId, tag_ids: unique };
}

/**
 * Rename a tag.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} tagId
 * @param {{name: string}} data
 * @returns {Promise<object>}
 * @throws {AppError} 400 invalid name, 404 tag missing, 409 duplicate name.
 */
async function update(userId, boardId, tagId, { name }) {
  if (!validateName(name)) {
    throw new AppError(400, `Tag name is required (max ${MAX_NAME_LENGTH} characters)`);
  }
  const trimmed = name.trim();
  const existing = await tagRepository.findByName(userId, boardId, trimmed);
  if (existing && existing.tag_id !== tagId) {
    throw new AppError(409, 'A tag with that name already exists on this board');
  }
  const tag = await tagRepository.update(userId, boardId, tagId, { name: trimmed });
  if (!tag) throw new AppError(404, 'Tag not found');
  await cache.invalidateBoard(userId, boardId);
  return tag;
}

/**
 * Delete a tag. Unlinks it from all concepts (ON DELETE CASCADE).
 * @param {string} userId
 * @param {string} boardId
 * @param {string} tagId
 * @returns {Promise<{tag_id: string}>}
 * @throws {AppError} 404 if tag missing.
 */
async function remove(userId, boardId, tagId) {
  const deleted = await tagRepository.remove(userId, boardId, tagId);
  if (!deleted) throw new AppError(404, 'Tag not found');
  await cache.invalidateBoard(userId, boardId);
  return { tag_id: tagId };
}

/**
 * Link a tag to a concept. Both must live on the same board the user owns.
 * Linking an already-linked pair is a no-op (idempotent success).
 * @param {string} userId
 * @param {string} boardId
 * @param {string} conceptId
 * @param {string} tagId
 * @returns {Promise<{concept_id: string, tag_id: string}>}
 * @throws {AppError} 400 on malformed UUIDs, 404 if concept/tag/board missing.
 */
async function linkConcept(userId, boardId, conceptId, tagId) {
  if (!validateId(conceptId) || !validateId(tagId)) {
    throw new AppError(400, 'conceptId and tagId must be valid UUIDs');
  }
  const concept = await conceptRepository.findById(userId, boardId, conceptId);
  if (!concept) throw new AppError(404, 'Concept not found');
  const tag = await tagRepository.findById(userId, boardId, tagId);
  if (!tag) throw new AppError(404, 'Tag not found');

  const link = await tagRepository.linkConcept(userId, boardId, conceptId, tagId);
  await cache.invalidateBoard(userId, boardId);
  // If the link already existed, linkConcept returns null (ON CONFLICT DO
  // NOTHING). Both entities were verified to exist, so treat as success.
  return link || { concept_id: conceptId, tag_id: tagId };
}

/**
 * Unlink a tag from a concept.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} conceptId
 * @param {string} tagId
 * @returns {Promise<{concept_id: string, tag_id: string}>}
 * @throws {AppError} 400 on malformed UUIDs, 404 if concept/tag/board missing.
 */
async function unlinkConcept(userId, boardId, conceptId, tagId) {
  if (!validateId(conceptId) || !validateId(tagId)) {
    throw new AppError(400, 'conceptId and tagId must be valid UUIDs');
  }
  const concept = await conceptRepository.findById(userId, boardId, conceptId);
  if (!concept) throw new AppError(404, 'Concept not found');
  const tag = await tagRepository.findById(userId, boardId, tagId);
  if (!tag) throw new AppError(404, 'Tag not found');

  const deleted = await tagRepository.unlinkConcept(userId, boardId, conceptId, tagId);
  if (!deleted) throw new AppError(404, 'Concept is not linked to that tag');
  await cache.invalidateBoard(userId, boardId);
  return { concept_id: conceptId, tag_id: tagId };
}

/**
 * List the tags attached to a concept.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} conceptId
 * @returns {Promise<Array<object>>}
 * @throws {AppError} 400 on malformed UUID, 404 if concept missing.
 */
async function listConceptTags(userId, boardId, conceptId) {
  if (!validateId(conceptId)) {
    throw new AppError(400, 'conceptId must be a valid UUID');
  }
  const concept = await conceptRepository.findById(userId, boardId, conceptId);
  if (!concept) throw new AppError(404, 'Concept not found');
  return tagRepository.findByConcept(userId, boardId, conceptId);
}

/**
 * Delete every tag on a board. Unlinks them from all concepts and settings
 * (cascades in the schema). Verified against ownership via the repo's SQL join.
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<{deleted: number}>}
 */
async function removeAll(userId, boardId) {
  const deleted = await tagRepository.removeAll(userId, boardId);
  await cache.invalidateBoard(userId, boardId);
  return { deleted };
}

module.exports = {
  list,
  getById,
  create,
  createMany,
  update,
  remove,
  linkConcept,
  linkMany,
  unlinkConcept,
  listConceptTags,
  removeAll,
};
