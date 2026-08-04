const tagService = require('../services/tagService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * GET /boards/:boardId/tags — list tags on the user's board.
 */
async function list(req, res) {
  const tags = await tagService.list(req.userId, req.params.boardId);
  return res.status(200).json({ tags });
}

/**
 * POST /boards/:boardId/tags — create a tag.
 */
async function create(req, res) {
  const { name } = req.body;
  const tag = await tagService.create(req.userId, req.params.boardId, { name });
  return res.status(201).json(tag);
}

/**
 * GET /boards/:boardId/tags/:tagId — fetch one tag.
 */
async function getById(req, res) {
  const tag = await tagService.getById(req.userId, req.params.boardId, req.params.tagId);
  return res.status(200).json(tag);
}

/**
 * PUT /boards/:boardId/tags/:tagId — rename a tag.
 */
async function update(req, res) {
  const { name } = req.body;
  const tag = await tagService.update(req.userId, req.params.boardId, req.params.tagId, { name });
  return res.status(200).json(tag);
}

/**
 * DELETE /boards/:boardId/tags/:tagId — delete a tag.
 */
async function remove(req, res) {
  const result = await tagService.remove(req.userId, req.params.boardId, req.params.tagId);
  return res.status(200).json(result);
}

/**
 * PUT /boards/:boardId/concepts/:conceptId/tags/:tagId — link a tag to a concept.
 */
async function linkConcept(req, res) {
  const result = await tagService.linkConcept(
    req.userId,
    req.params.boardId,
    req.params.conceptId,
    req.params.tagId
  );
  return res.status(200).json(result);
}

/**
 * DELETE /boards/:boardId/concepts/:conceptId/tags/:tagId — unlink a tag
 * from a concept.
 */
async function unlinkConcept(req, res) {
  const result = await tagService.unlinkConcept(
    req.userId,
    req.params.boardId,
    req.params.conceptId,
    req.params.tagId
  );
  return res.status(200).json(result);
}

/**
 * GET /boards/:boardId/concepts/:conceptId/tags — list a concept's tags.
 */
async function listConceptTags(req, res) {
  const tags = await tagService.listConceptTags(req.userId, req.params.boardId, req.params.conceptId);
  return res.status(200).json({ tags });
}

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  getById: asyncHandler(getById),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
  linkConcept: asyncHandler(linkConcept),
  unlinkConcept: asyncHandler(unlinkConcept),
  listConceptTags: asyncHandler(listConceptTags),
};
