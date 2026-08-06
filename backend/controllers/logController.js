const logService = require('../services/logService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * GET /boards/:boardId/logs — list logs on the user's board.
 */
async function list(req, res) {
  const logs = await logService.list(req.userId, req.params.boardId);
  return res.status(200).json({ logs });
}

/**
 * POST /boards/:boardId/logs — create a log.
 */
async function create(req, res) {
  const { title, content } = req.body;
  const log = await logService.create(req.userId, req.params.boardId, { title, content });
  return res.status(201).json(log);
}

/**
 * GET /boards/:boardId/logs/:logId — fetch one log.
 */
async function getById(req, res) {
  const log = await logService.getById(req.userId, req.params.boardId, req.params.logId);
  return res.status(200).json(log);
}

/**
 * PUT /boards/:boardId/logs/:logId — update a log's title and/or content.
 */
async function update(req, res) {
  const { title, content } = req.body;
  const log = await logService.update(req.userId, req.params.boardId, req.params.logId, { title, content });
  return res.status(200).json(log);
}

/**
 * DELETE /boards/:boardId/logs/:logId — delete a log.
 */
async function remove(req, res) {
  const result = await logService.remove(req.userId, req.params.boardId, req.params.logId);
  return res.status(200).json(result);
}

/**
 * DELETE /boards/:boardId/logs — delete every log on the board.
 */
async function removeAll(req, res) {
  const result = await logService.removeAll(req.userId, req.params.boardId);
  return res.status(200).json(result);
}

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  getById: asyncHandler(getById),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
  removeAll: asyncHandler(removeAll),
};
