const boardService = require('../services/boardService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * GET /boards — list the current user's boards.
 */
async function list(req, res) {
  const boards = await boardService.list(req.userId);
  return res.status(200).json({ boards });
}

/**
 * POST /boards — create a board owned by the current user.
 */
async function create(req, res) {
  const { name, masteryThreshold, subject, color } = req.body;
  const board = await boardService.create({ userId: req.userId, name, masteryThreshold, subject, color });
  return res.status(201).json(board);
}

/**
 * GET /boards/:boardId — fetch one board (ownership enforced in service).
 */
async function getById(req, res) {
  const board = await boardService.getById(req.userId, req.params.boardId);
  return res.status(200).json(board);
}

/**
 * PUT /boards/:boardId — update a board's name, subject, color, and/or mastery
 * threshold.
 */
async function update(req, res) {
  const { name, masteryThreshold, subject, color } = req.body;
  const board = await boardService.update(req.userId, req.params.boardId, { name, masteryThreshold, subject, color });
  return res.status(200).json(board);
}

/**
 * DELETE /boards/:boardId — delete a board.
 */
async function remove(req, res) {
  const result = await boardService.remove(req.userId, req.params.boardId);
  return res.status(200).json(result);
}

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  getById: asyncHandler(getById),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
