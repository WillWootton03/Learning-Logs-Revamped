const conceptRepository = require('../repositories/conceptRepository');
const AppError = require('./AppError');
const { isUuid } = require('../utils/validate');

const MAX_PROMPT_LENGTH = 500;
const MAX_ANSWER_LENGTH = 500;
const MAX_HINT_LENGTH = 500;
const MAX_TAG_LENGTH = 50;
const MAX_IMPORT_ROWS = 500;

/**
 * Validate a concept prompt: required, non-empty, max 500 chars.
 * @param {*} prompt
 * @returns {boolean}
 */
function validatePrompt(prompt) {
  return typeof prompt === 'string' && prompt.trim().length > 0 && prompt.trim().length <= MAX_PROMPT_LENGTH;
}

/**
 * Validate a concept answer: required, non-empty, max 500 chars.
 * @param {*} answer
 * @returns {boolean}
 */
function validateAnswer(answer) {
  return typeof answer === 'string' && answer.trim().length > 0 && answer.trim().length <= MAX_ANSWER_LENGTH;
}

/**
 * Validate an optional hint: null, or a string up to 500 chars.
 * @param {*} hint
 * @returns {boolean}
 */
function validateHint(hint) {
  return hint === null || hint === undefined || (typeof hint === 'string' && hint.trim().length <= MAX_HINT_LENGTH);
}

/**
 * List all concepts on a board the user owns, optionally filtered to a tag.
 * @param {string} userId
 * @param {string} boardId
 * @param {string|null} tagId - Optional tag id (UUID) to filter by.
 * @returns {Promise<Array<object>>}
 * @throws {AppError} 400 if tagId is not a well-formed UUID.
 */
async function list(userId, boardId, tagId) {
  if (tagId !== undefined && tagId !== null && !isUuid(tagId)) {
    throw new AppError(400, 'tag must be a valid UUID');
  }
  return conceptRepository.findAllByBoard(userId, boardId, tagId || null);
}

/**
 * Fetch one concept, verifying the user owns its board.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} conceptId
 * @returns {Promise<object>}
 * @throws {AppError} 404 if concept or board is missing/foreign.
 */
async function getById(userId, boardId, conceptId) {
  const concept = await conceptRepository.findById(userId, boardId, conceptId);
  if (!concept) throw new AppError(404, 'Concept not found');
  return concept;
}

/**
 * Create a concept on a board the user owns.
 * @param {string} userId
 * @param {string} boardId
 * @param {{prompt: string, answer: string, hint?: string|null}} data
 * @returns {Promise<object>}
 * @throws {AppError} 400 on invalid fields, 404 if board missing/foreign.
 */
async function create(userId, boardId, { prompt, answer, hint = null }) {
  if (!validatePrompt(prompt)) {
    throw new AppError(400, `Prompt is required (max ${MAX_PROMPT_LENGTH} characters)`);
  }
  if (!validateAnswer(answer)) {
    throw new AppError(400, `Answer is required (max ${MAX_ANSWER_LENGTH} characters)`);
  }
  if (!validateHint(hint)) {
    throw new AppError(400, `Hint cannot exceed ${MAX_HINT_LENGTH} characters`);
  }
  const concept = await conceptRepository.create(userId, boardId, {
    prompt: prompt.trim(),
    answer: answer.trim(),
    hint: hint === null || hint === undefined ? null : hint.trim(),
  });
  if (!concept) throw new AppError(404, 'Board not found');
  return concept;
}

/**
 * Update a concept's prompt, answer, and/or hint. The mastery counter is not
 * editable via this endpoint.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} conceptId
 * @param {{prompt?: string, answer?: string, hint?: string|null}} changes
 * @returns {Promise<object>}
 * @throws {AppError} 400 if nothing valid to update, 404 if concept/board missing.
 */
async function update(userId, boardId, conceptId, { prompt, answer, hint }) {
  const changes = {};
  if (prompt !== undefined) {
    if (!validatePrompt(prompt)) {
      throw new AppError(400, `Prompt is required (max ${MAX_PROMPT_LENGTH} characters)`);
    }
    changes.prompt = prompt.trim();
  }
  if (answer !== undefined) {
    if (!validateAnswer(answer)) {
      throw new AppError(400, `Answer is required (max ${MAX_ANSWER_LENGTH} characters)`);
    }
    changes.answer = answer.trim();
  }
  if (hint !== undefined) {
    if (!validateHint(hint)) {
      throw new AppError(400, `Hint cannot exceed ${MAX_HINT_LENGTH} characters`);
    }
    changes.hint = hint === null ? null : hint.trim();
  }
  if (Object.keys(changes).length === 0) {
    throw new AppError(400, 'Provide a prompt, answer, or hint to update');
  }
  const concept = await conceptRepository.update(userId, boardId, conceptId, changes);
  if (!concept) throw new AppError(404, 'Concept not found');
  return concept;
}

/**
 * Delete a concept.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} conceptId
 * @returns {Promise<{concept_id: string}>}
 * @throws {AppError} 404 if concept/board missing.
 */
async function remove(userId, boardId, conceptId) {
  const deleted = await conceptRepository.remove(userId, boardId, conceptId);
  if (!deleted) throw new AppError(404, 'Concept not found');
  return { concept_id: conceptId };
}

/**
 * Set a concept's learned status directly. Because "learned" is derived from
 * the mastery counter, this moves the counter to the board's mastery
 * threshold (learned) or back to 0 (unlearned).
 * @param {string} userId
 * @param {string} boardId
 * @param {string} conceptId
 * @param {boolean} learned
 * @returns {Promise<object>}
 * @throws {AppError} 400 if learned is not a boolean, 404 if concept missing.
 */
async function setLearned(userId, boardId, conceptId, learned) {
  if (typeof learned !== 'boolean') {
    throw new AppError(400, 'learned must be a boolean');
  }
  const concept = await conceptRepository.setLearned(userId, boardId, conceptId, learned);
  if (!concept) throw new AppError(404, 'Concept not found');
  return concept;
}

/**
 * Bulk-import concepts with their tags from CSV-derived rows. Validates every
 * row up front (so one bad row rejects the whole import rather than a partial
 * insert), normalizes tag names, then delegates to the transactional batch
 * insert (tags → concepts → links).
 * @param {string} userId
 * @param {string} boardId
 * @param {*} rows - Array of { prompt, answer, hint, tags } objects.
 * @returns {Promise<Array<object>>} Created concept rows with their tag names.
 * @throws {AppError} 400 on an empty/invalid payload or any bad row, 404 if
 *   the board is missing/foreign.
 */
async function importMany(userId, boardId, rows) {
  if (rows === undefined || rows === null || !Array.isArray(rows)) {
    throw new AppError(400, 'concepts must be an array');
  }
  if (rows.length === 0) {
    throw new AppError(400, 'Provide at least one concept to import');
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new AppError(400, `Import is limited to ${MAX_IMPORT_ROWS} concepts at a time`);
  }

  const cleaned = rows.map((row, i) => {
    if (!row || typeof row !== 'object') {
      throw new AppError(400, `Row ${i + 1} is not a valid concept`);
    }
    const { prompt, answer, hint, tags } = row;
    if (!validatePrompt(prompt)) {
      throw new AppError(400, `Row ${i + 1}: prompt is required (max ${MAX_PROMPT_LENGTH} characters)`);
    }
    if (!validateAnswer(answer)) {
      throw new AppError(400, `Row ${i + 1}: answer is required (max ${MAX_ANSWER_LENGTH} characters)`);
    }
    if (!validateHint(hint)) {
      throw new AppError(400, `Row ${i + 1}: hint cannot exceed ${MAX_HINT_LENGTH} characters`);
    }
    if (tags !== undefined && tags !== null && typeof tags !== 'string' && !Array.isArray(tags)) {
      throw new AppError(400, `Row ${i + 1}: tags must be a comma-separated string or an array of strings`);
    }
    // Tags arrive as a comma-separated string (e.g. "hooks,react,intermediate");
    // normalize both forms into a clean, de-duplicated array of trimmed names.
    const rawTags =
      typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
        : tags ?? [];
    const tagList = [...new Set(rawTags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter((t) => t.length > 0))];
    for (const tag of tagList) {
      if (typeof tag !== 'string' || tag.length > MAX_TAG_LENGTH) {
        throw new AppError(400, `Row ${i + 1}: tags cannot exceed ${MAX_TAG_LENGTH} characters`);
      }
    }
    return {
      prompt: prompt.trim(),
      answer: answer.trim(),
      hint: hint === null || hint === undefined || hint === '' ? null : hint.trim(),
      tags: tagList,
    };
  });

  return conceptRepository.importMany(userId, boardId, cleaned);
}

/**
 * Delete every concept on a board. Verified against ownership via the repo's
 * SQL join; a foreign or missing board deletes nothing.
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<{deleted: number}>}
 */
async function removeAll(userId, boardId) {
  const deleted = await conceptRepository.removeAll(userId, boardId);
  return { deleted };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  setLearned,
  importMany,
  removeAll,
};
