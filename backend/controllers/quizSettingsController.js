const quizSettingsService = require('../services/quizSettingsService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * GET /boards/:boardId/quiz-settings — list saved quiz settings.
 */
async function list(req, res) {
  const settings = await quizSettingsService.list(req.userId, req.params.boardId);
  return res.status(200).json({ settings });
}

/**
 * POST /boards/:boardId/quiz-settings — save quiz settings.
 */
async function create(req, res) {
  const { name, style, includeKnown, exactMatching, tagIds } = req.body;
  const setting = await quizSettingsService.create(req.userId, req.params.boardId, {
    name,
    style,
    includeKnown,
    exactMatching,
    tagIds,
  });
  return res.status(201).json(setting);
}

/**
 * GET /boards/:boardId/quiz-settings/:quizSettingsId — fetch one setting.
 */
async function getById(req, res) {
  const setting = await quizSettingsService.getById(
    req.userId,
    req.params.boardId,
    req.params.quizSettingsId
  );
  return res.status(200).json(setting);
}

/**
 * PUT /boards/:boardId/quiz-settings/:quizSettingsId — update a setting's
 * fields. Tag filtering is managed via the /tags endpoints.
 */
async function update(req, res) {
  const { name, style, includeKnown, exactMatching } = req.body;
  const setting = await quizSettingsService.update(
    req.userId,
    req.params.boardId,
    req.params.quizSettingsId,
    { name, style, includeKnown, exactMatching }
  );
  return res.status(200).json(setting);
}

/**
 * POST /boards/:boardId/quiz-settings/:quizSettingsId/tags — link tags.
 */
async function addTags(req, res) {
  const { tagIds } = req.body;
  const setting = await quizSettingsService.addTags(
    req.userId,
    req.params.boardId,
    req.params.quizSettingsId,
    tagIds
  );
  return res.status(200).json(setting);
}

/**
 * DELETE /boards/:boardId/quiz-settings/:quizSettingsId/tags — unlink tags.
 */
async function removeTags(req, res) {
  const { tagIds } = req.body;
  const setting = await quizSettingsService.removeTags(
    req.userId,
    req.params.boardId,
    req.params.quizSettingsId,
    tagIds
  );
  return res.status(200).json(setting);
}

/**
 * DELETE /boards/:boardId/quiz-settings/:quizSettingsId — delete a setting.
 */
async function remove(req, res) {
  const result = await quizSettingsService.remove(
    req.userId,
    req.params.boardId,
    req.params.quizSettingsId
  );
  return res.status(200).json(result);
}

module.exports = {
  list: asyncHandler(list),
  create: asyncHandler(create),
  getById: asyncHandler(getById),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
  addTags: asyncHandler(addTags),
  removeTags: asyncHandler(removeTags),
};
