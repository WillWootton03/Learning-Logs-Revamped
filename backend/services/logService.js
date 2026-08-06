const logRepository = require('../repositories/logRepository');
const AppError = require('./AppError');

const MAX_TITLE_LENGTH = 120;

/**
 * Validate a log title: required, non-empty, max 120 chars.
 * @param {*} title
 * @returns {boolean}
 */
function validateTitle(title) {
  return typeof title === 'string' && title.trim().length > 0 && title.trim().length <= MAX_TITLE_LENGTH;
}

/**
 * Validate log content: must be a string when provided. Notes are optional —
 * an empty body is a valid log — so there is no non-empty requirement.
 * @param {*} content
 * @returns {boolean}
 */
function validateContent(content) {
  return typeof content === 'string';
}

/**
 * List all logs on a board the user owns.
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<Array<object>>}
 */
async function list(userId, boardId) {
  return logRepository.findAllByBoard(userId, boardId);
}

/**
 * Fetch one log, verifying the user owns its board.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} logId
 * @returns {Promise<object>}
 * @throws {AppError} 404 if log or board is missing/foreign.
 */
async function getById(userId, boardId, logId) {
  const log = await logRepository.findById(userId, boardId, logId);
  if (!log) throw new AppError(404, 'Log not found');
  return log;
}

/**
 * Create a log on a board the user owns.
 * @param {string} userId
 * @param {string} boardId
 * @param {{title: string, content?: string}} data
 * @returns {Promise<object>}
 * @throws {AppError} 400 on invalid fields, 404 if board missing/foreign.
 */
async function create(userId, boardId, { title, content }) {
  if (!validateTitle(title)) {
    throw new AppError(400, `Title is required (max ${MAX_TITLE_LENGTH} characters)`);
  }
  if (!validateContent(content ?? '')) {
    throw new AppError(400, 'Content must be a string');
  }
  const log = await logRepository.create(userId, boardId, { title: title.trim(), content: content ?? '' });
  if (!log) throw new AppError(404, 'Board not found');
  return log;
}

/**
 * Update a log's title and/or content.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} logId
 * @param {{title?: string, content?: string}} changes
 * @returns {Promise<object>}
 * @throws {AppError} 400 if nothing valid to update, 404 if log/board missing.
 */
async function update(userId, boardId, logId, { title, content }) {
  const changes = {};
  if (title !== undefined) {
    if (!validateTitle(title)) {
      throw new AppError(400, `Title is required (max ${MAX_TITLE_LENGTH} characters)`);
    }
    changes.title = title.trim();
  }
  if (content !== undefined) {
    if (!validateContent(content)) {
      throw new AppError(400, 'Content must be a string');
    }
    changes.content = content;
  }
  if (Object.keys(changes).length === 0) {
    throw new AppError(400, 'Provide a title or content to update');
  }
  const log = await logRepository.update(userId, boardId, logId, changes);
  if (!log) throw new AppError(404, 'Log not found');
  return log;
}

/**
 * Delete a log.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} logId
 * @returns {Promise<{log_id: string}>}
 * @throws {AppError} 404 if log/board missing.
 */
async function remove(userId, boardId, logId) {
  const deleted = await logRepository.remove(userId, boardId, logId);
  if (!deleted) throw new AppError(404, 'Log not found');
  return { log_id: logId };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
