const quizSettingsRepository = require('../repositories/quizSettingsRepository');
const tagRepository = require('../repositories/tagRepository');
const cache = require('./cache');
const AppError = require('./AppError');
const { isUuid } = require('../utils/validate');

const MAX_NAME_LENGTH = 100;
const QUIZ_STYLES = ['true_false', 'multiple_choice', 'fill_in'];

/**
 * Validate a settings name: required, non-empty, max 100 chars.
 * @param {*} name
 * @returns {boolean}
 */
function validateName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;
}

/**
 * Validate the quiz style against the supported set.
 * @param {*} style
 * @returns {boolean}
 */
function validateStyle(style) {
  return typeof style === 'string' && QUIZ_STYLES.includes(style);
}

/**
 * Validate an optional list of tag ids: each must be a well-formed UUID and
 * must exist on the user's board. Returns the deduplicated ids.
 * @param {string} userId
 * @param {string} boardId
 * @param {*} tagIds
 * @returns {Promise<string[]>}
 * @throws {AppError} 400 on malformed/unknown ids.
 */
async function resolveTagIds(userId, boardId, tagIds) {
  if (tagIds === undefined || tagIds === null) return [];
  if (!Array.isArray(tagIds)) {
    throw new AppError(400, 'tagIds must be an array of UUIDs');
  }
  const unique = [...new Set(tagIds)];
  for (const id of unique) {
    if (!isUuid(id)) {
      throw new AppError(400, 'tagIds must contain valid UUIDs');
    }
  }
  // One batch query validates every id against the board; any id that doesn't
  // come back means the caller supplied a foreign or fake tag.
  const found = await tagRepository.findByIds(userId, boardId, unique);
  if (found.length !== unique.length) {
    throw new AppError(400, 'One or more tags do not exist on this board');
  }
  return unique;
}

/**
 * List all quiz settings for a board, each with its linked tag ids.
 * The fully-assembled list (tag ids resolved per setting) is cached for 30
 * minutes; a miss hits Postgres and repopulates.
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<Array<object>>}
 */
async function list(userId, boardId) {
  const key = cache.boardKey(userId, boardId, 'quizSettings');
  const cached = await cache.getJSON(key);
  if (cached) return cached;
  const settings = await quizSettingsRepository.findAllByBoard(userId, boardId);
  for (const setting of settings) {
    setting.tag_ids = await quizSettingsRepository.findTagIds(userId, boardId, setting.quiz_settings_id);
  }
  await cache.setJSON(key, settings);
  return settings;
}

/**
 * Fetch one quiz setting with its tag ids.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} quizSettingsId
 * @returns {Promise<object>}
 * @throws {AppError} 404 if missing or not owned.
 */
async function getById(userId, boardId, quizSettingsId) {
  const setting = await quizSettingsRepository.findById(userId, boardId, quizSettingsId);
  if (!setting) throw new AppError(404, 'Quiz settings not found');
  setting.tag_ids = await quizSettingsRepository.findTagIds(userId, boardId, quizSettingsId);
  return setting;
}

/**
 * Create quiz settings, optionally linked to tags.
 * @param {string} userId
 * @param {string} boardId
 * @param {{name: string, style: string, includeKnown?: boolean, exactMatching?: boolean, matchAllTags?: boolean, tagIds?: string[]}} data
 * @returns {Promise<object>}
 * @throws {AppError} 400 on invalid fields, 404 if board missing.
 */
async function create(
  userId,
  boardId,
  { name, style, includeKnown = false, exactMatching = false, matchAllTags = false, tagIds }
) {
  if (!validateName(name)) {
    throw new AppError(400, `Name is required (max ${MAX_NAME_LENGTH} characters)`);
  }
  if (!validateStyle(style)) {
    throw new AppError(400, `style must be one of: ${QUIZ_STYLES.join(', ')}`);
  }
  if (typeof includeKnown !== 'boolean') {
    throw new AppError(400, 'includeKnown must be a boolean');
  }
  if (typeof exactMatching !== 'boolean') {
    throw new AppError(400, 'exactMatching must be a boolean');
  }
  if (typeof matchAllTags !== 'boolean') {
    throw new AppError(400, 'matchAllTags must be a boolean');
  }
  const resolvedTagIds = await resolveTagIds(userId, boardId, tagIds);
  const setting = await quizSettingsRepository.create(userId, boardId, {
    name: name.trim(),
    style,
    includeKnown,
    exactMatching,
    matchAllTags,
  });
  if (!setting) throw new AppError(404, 'Board not found');
  if (resolvedTagIds.length > 0) {
    await quizSettingsRepository.addTags(setting.quiz_settings_id, resolvedTagIds);
  }
  setting.tag_ids = resolvedTagIds;
  await cache.invalidateBoard(userId, boardId);
  return setting;
}

/**
 * Update quiz settings (name, style, include_known). Tag filtering is managed
 * separately through addTags/removeTags — update does not touch links.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} quizSettingsId
 * @param {{name?: string, style?: string, includeKnown?: boolean, exactMatching?: boolean, matchAllTags?: boolean}} changes
 * @returns {Promise<object>}
 * @throws {AppError} 400 on invalid fields, 404 if settings missing.
 */
async function update(userId, boardId, quizSettingsId, { name, style, includeKnown, exactMatching, matchAllTags }) {
  const fields = {};
  if (name !== undefined) {
    if (!validateName(name)) {
      throw new AppError(400, `Name is required (max ${MAX_NAME_LENGTH} characters)`);
    }
    fields.name = name.trim();
  }
  if (style !== undefined) {
    if (!validateStyle(style)) {
      throw new AppError(400, `style must be one of: ${QUIZ_STYLES.join(', ')}`);
    }
    fields.style = style;
  }
  if (includeKnown !== undefined) {
    if (typeof includeKnown !== 'boolean') {
      throw new AppError(400, 'includeKnown must be a boolean');
    }
    fields.includeKnown = includeKnown;
  }
  if (exactMatching !== undefined) {
    if (typeof exactMatching !== 'boolean') {
      throw new AppError(400, 'exactMatching must be a boolean');
    }
    fields.exactMatching = exactMatching;
  }
  if (matchAllTags !== undefined) {
    if (typeof matchAllTags !== 'boolean') {
      throw new AppError(400, 'matchAllTags must be a boolean');
    }
    fields.matchAllTags = matchAllTags;
  }
  let setting;
  if (Object.keys(fields).length > 0) {
    setting = await quizSettingsRepository.update(userId, boardId, quizSettingsId, fields);
    if (!setting) throw new AppError(404, 'Quiz settings not found');
  } else {
    setting = await quizSettingsRepository.findById(userId, boardId, quizSettingsId);
    if (!setting) throw new AppError(404, 'Quiz settings not found');
  }
  setting.tag_ids = await quizSettingsRepository.findTagIds(userId, boardId, quizSettingsId);
  await cache.invalidateBoard(userId, boardId);
  return setting;
}

/**
 * Link tags to a quiz setting. Each id must be a valid UUID that exists on
 * the board; already-linked tags are no-ops.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} quizSettingsId
 * @param {string[]} tagIds
 * @returns {Promise<object>} Settings with refreshed tag_ids.
 * @throws {AppError} 400 on invalid/foreign ids, 404 if settings missing.
 */
async function addTags(userId, boardId, quizSettingsId, tagIds) {
  const setting = await quizSettingsRepository.findById(userId, boardId, quizSettingsId);
  if (!setting) throw new AppError(404, 'Quiz settings not found');
  const resolvedTagIds = await resolveTagIds(userId, boardId, tagIds);
  if (resolvedTagIds.length > 0) {
    await quizSettingsRepository.addTags(quizSettingsId, resolvedTagIds);
  }
  setting.tag_ids = await quizSettingsRepository.findTagIds(userId, boardId, quizSettingsId);
  await cache.invalidateBoard(userId, boardId);
  return setting;
}

/**
 * Unlink tags from a quiz setting. Ids only need to be well-formed UUIDs —
 * a non-existent link is simply a no-op delete.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} quizSettingsId
 * @param {string[]} tagIds
 * @returns {Promise<object>} Settings with refreshed tag_ids.
 * @throws {AppError} 400 on malformed ids, 404 if settings missing.
 */
async function removeTags(userId, boardId, quizSettingsId, tagIds) {
  const setting = await quizSettingsRepository.findById(userId, boardId, quizSettingsId);
  if (!setting) throw new AppError(404, 'Quiz settings not found');
  if (tagIds === undefined || tagIds === null || !Array.isArray(tagIds)) {
    throw new AppError(400, 'tagIds must be an array of UUIDs');
  }
  const unique = [...new Set(tagIds)];
  for (const id of unique) {
    if (!isUuid(id)) {
      throw new AppError(400, 'tagIds must contain valid UUIDs');
    }
  }
  await quizSettingsRepository.removeTags(quizSettingsId, unique);
  setting.tag_ids = await quizSettingsRepository.findTagIds(userId, boardId, quizSettingsId);
  await cache.invalidateBoard(userId, boardId);
  return setting;
}

/**
 * Delete quiz settings.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} quizSettingsId
 * @returns {Promise<{quiz_settings_id: string}>}
 * @throws {AppError} 404 if settings missing.
 */
async function remove(userId, boardId, quizSettingsId) {
  const deleted = await quizSettingsRepository.remove(userId, boardId, quizSettingsId);
  if (!deleted) throw new AppError(404, 'Quiz settings not found');
  await cache.invalidateBoard(userId, boardId);
  return { quiz_settings_id: quizSettingsId };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  addTags,
  removeTags,
};
