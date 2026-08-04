const boardRepository = require('../repositories/boardRepository');
const AppError = require('./AppError');

const MAX_NAME_LENGTH = 100;

/**
 * Validate a board name: required, non-empty, max 100 chars.
 * @param {*} name
 * @returns {boolean}
 */
function validateName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;
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
 * @param {{userId: string, name: string, masteryThreshold?: number}} data
 * @returns {Promise<object>}
 * @throws {AppError} 400 on invalid name or threshold.
 */
async function create({ userId, name, masteryThreshold = 20 }) {
  if (!validateName(name)) {
    throw new AppError(400, `Board name is required (max ${MAX_NAME_LENGTH} characters)`);
  }
  if (!validateMasteryThreshold(masteryThreshold)) {
    throw new AppError(400, 'masteryThreshold must be a positive integer');
  }
  return boardRepository.create({ userId, name, masteryThreshold });
}

/**
 * Update a board's name and/or mastery threshold. Throws 400 if nothing to
 * update, 404 if the board is missing or not owned by the user.
 * @param {string} userId
 * @param {string} boardId
 * @param {{name?: string, masteryThreshold?: number}} changes
 * @returns {Promise<object>}
 */
async function update(userId, boardId, { name, masteryThreshold }) {
  const changes = {};
  if (name !== undefined) {
    if (!validateName(name)) {
      throw new AppError(400, `Board name is required (max ${MAX_NAME_LENGTH} characters)`);
    }
    changes.name = name.trim();
  }
  if (masteryThreshold !== undefined) {
    if (!validateMasteryThreshold(masteryThreshold)) {
      throw new AppError(400, 'masteryThreshold must be a positive integer');
    }
    changes.masteryThreshold = masteryThreshold;
  }
  if (Object.keys(changes).length === 0) {
    throw new AppError(400, 'Provide a name or masteryThreshold to update');
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
