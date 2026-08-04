const conceptService = require('../services/conceptService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * GET /boards/:boardId/concepts — list concepts on the user's board.
 * Supports ?tag=<tagId> to filter to a single tag.
 */
async function list(req, res) {
  const concepts = await conceptService.list(req.userId, req.params.boardId, req.query.tag);
  return res.status(200).json({ concepts });
}

/**
 * POST /boards/:boardId/concepts — create a concept.
 */
async function create(req, res) {
  const { prompt, answer, hint } = req.body;
  const concept = await conceptService.create(req.userId, req.params.boardId, { prompt, answer, hint });
  return res.status(201).json(concept);
}

/**
 * GET /boards/:boardId/concepts/:conceptId — fetch one concept.
 */
async function getById(req, res) {
  const concept = await conceptService.getById(req.userId, req.params.boardId, req.params.conceptId);
  return res.status(200).json(concept);
}

/**
 * PUT /boards/:boardId/concepts/:conceptId — update a concept's prompt,
 * answer, and/or hint.
 */
async function update(req, res) {
  const { prompt, answer, hint } = req.body;
  const concept = await conceptService.update(
    req.userId,
    req.params.boardId,
    req.params.conceptId,
    { prompt, answer, hint }
  );
  return res.status(200).json(concept);
}

/**
 * DELETE /boards/:boardId/concepts/:conceptId — delete a concept.
 */
async function remove(req, res) {
  const result = await conceptService.remove(req.userId, req.params.boardId, req.params.conceptId);
  return res.status(200).json(result);
}

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  getById: asyncHandler(getById),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
