const boardRepository = require('../repositories/boardRepository');
const AppError = require('./AppError');

const MAX_NAME_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 50;
const DEFAULT_COLOR = '#7c6af7';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate a board name: required, non-empty, max 100 chars.
 * @param {*} name
 * @returns {boolean}
 */
function validateName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;
}

/**
 * Validate a subject label: optional, but when present must be a non-empty
 * string of at most 50 chars.
 * @param {*} subject
 * @returns {boolean}
 */
function validateSubject(subject) {
  return subject === undefined || (typeof subject === 'string' && subject.trim().length > 0 && subject.trim().length <= MAX_SUBJECT_LENGTH);
}

/**
 * Validate a hex accent color (#rrggbb).
 * @param {*} color
 * @returns {boolean}
 */
function validateColor(color) {
  return color === undefined || (typeof color === 'string' && HEX_COLOR.test(color));
}

/**
 * Validate a mastery threshold: a positive integer.
 * @param {*} value
 * @returns {boolean}
 */
function validateMasteryThreshold(value) {
  return Number.isInteger(value) && value >= 1;
}

/**
 * List all boards for a user.
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function list(userId) {
  return boardRepository.findAllByUserId(userId);
}

/**
 * Fetch one board, verifying the user owns it. Throws 404 if missing or
 * owned by someone else (does not leak that another user's board exists).
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<object>}
 */
async function getById(userId, boardId) {
  const board = await boardRepository.findById(userId, boardId);
  if (!board) throw new AppError(404, 'Board not found');
  return board;
}

/**
 * Create a board.
 * @param {{userId: string, name: string, subject?: string, color?: string, masteryThreshold?: number}} data
 * @returns {Promise<object>}
 * @throws {AppError} 400 on invalid name, subject, color, or threshold.
 */
async function create({ userId, name, masteryThreshold = 20, subject, color }) {
  if (!validateName(name)) {
    throw new AppError(400, `Board name is required (max ${MAX_NAME_LENGTH} characters)`);
  }
  if (!validateMasteryThreshold(masteryThreshold)) {
    throw new AppError(400, 'masteryThreshold must be a positive integer');
  }
  if (!validateSubject(subject)) {
    throw new AppError(400, `Subject must be a non-empty string (max ${MAX_SUBJECT_LENGTH} characters)`);
  }
  if (!validateColor(color)) {
    throw new AppError(400, 'Color must be a hex value like #7c6af7');
  }
  return boardRepository.create({
    userId,
    name: name.trim(),
    subject: subject === undefined ? 'Other' : subject.trim(),
    color: color === undefined ? DEFAULT_COLOR : color,
    masteryThreshold,
  });
}

/**
 * Update a board's name, subject, color, and/or mastery threshold. Throws 400
 * if nothing to update, 404 if the board is missing or not owned by the user.
 * @param {string} userId
 * @param {string} boardId
 * @param {{name?: string, subject?: string, color?: string, masteryThreshold?: number}} changes
 * @returns {Promise<object>}
 */
async function update(userId, boardId, { name, subject, color, masteryThreshold }) {
  const changes = {};
  if (name !== undefined) {
    if (!validateName(name)) {
      throw new AppError(400, `Board name is required (max ${MAX_NAME_LENGTH} characters)`);
    }
    changes.name = name.trim();
  }
  if (subject !== undefined) {
    if (!validateSubject(subject)) {
      throw new AppError(400, `Subject must be a non-empty string (max ${MAX_SUBJECT_LENGTH} characters)`);
    }
    changes.subject = subject.trim();
  }
  if (color !== undefined) {
    if (!validateColor(color)) {
      throw new AppError(400, 'Color must be a hex value like #7c6af7');
    }
    changes.color = color;
  }
  if (masteryThreshold !== undefined) {
    if (!validateMasteryThreshold(masteryThreshold)) {
      throw new AppError(400, 'masteryThreshold must be a positive integer');
    }
    changes.masteryThreshold = masteryThreshold;
  }
  if (Object.keys(changes).length === 0) {
    throw new AppError(400, 'Provide a name, subject, color, or masteryThreshold to update');
  }
  const board = await boardRepository.update(userId, boardId, changes);
  if (!board) throw new AppError(404, 'Board not found');
  return board;
}

/**
 * Delete a board. Throws 404 if missing or not owned by the user.
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<{board_id: string}>}
 */
async function remove(userId, boardId) {
  const deleted = await boardRepository.remove(userId, boardId);
  if (!deleted) throw new AppError(404, 'Board not found');
  return { board_id: boardId };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
