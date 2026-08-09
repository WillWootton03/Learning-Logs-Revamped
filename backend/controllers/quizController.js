const quizService = require('../services/quizService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * POST /boards/:boardId/quizzes/generate — generate questions for a quiz.
 * Body: { style, tagIds?, includeKnown?, questionCount? }.
 */
async function generateQuestions(req, res) {
  const { style, tagIds, includeKnown, questionCount, matchAll } = req.body;
  const questions = await quizService.generateQuestions(req.userId, req.params.boardId, {
    style,
    tagIds,
    includeKnown,
    questionCount,
    matchAll,
  });
  return res.status(200).json({ questions });
}

/**
 * POST /boards/:boardId/quizzes — record a completed one-off quiz run.
 * Body: { style, tagIds?, includeKnown?, timeElapsedMs, answers }.
 */
async function recordRun(req, res) {
  const { style, tagIds, includeKnown, timeElapsedMs, answers, exactMatching } = req.body;
  const result = await quizService.recordRun(req.userId, req.params.boardId, {
    style,
    tagIds,
    includeKnown,
    timeElapsedMs,
    answers,
    exactMatching,
  });
  return res.status(201).json(result);
}

/**
 * POST /boards/:boardId/quiz-settings/:quizSettingsId/quizzes — record a run
 * from a saved setting (style/tags/known come from the setting).
 */
async function recordRunFromSettings(req, res) {
  const { timeElapsedMs, answers } = req.body;
  // exactMatching comes from the persisted setting — the client's flag is
  // ignored for saved-setting runs so scoring can't be overridden client-side.
  const result = await quizService.recordRunFromSettings(
    req.userId,
    req.params.boardId,
    req.params.quizSettingsId,
    { timeElapsedMs, answers }
  );
  return res.status(201).json(result);
}

/**
 * GET /users/me/runs — list every quiz run across the user's boards, newest
 * first, for the activity log. Scoped by the authenticated user id.
 */
async function listAllRuns(req, res) {
  const runs = await quizService.listAllRuns(req.userId);
  return res.status(200).json({ runs });
}

/**
 * GET /boards/:boardId/quizzes — list all quiz runs on the board.
 */
async function listRuns(req, res) {
  const runs = await quizService.listRuns(req.userId, req.params.boardId);
  return res.status(200).json({ runs });
}

/**
 * GET /boards/:boardId/quiz-settings/:quizSettingsId/quizzes — list runs
 * created from one saved setting.
 */
async function listRunsBySettings(req, res) {
  const runs = await quizService.listRunsBySettings(
    req.userId,
    req.params.boardId,
    req.params.quizSettingsId
  );
  return res.status(200).json({ runs });
}

/**
 * GET /boards/:boardId/quizzes/:quizId — fetch a run with its breakdown.
 * Also used (via the same controller) under quiz-settings routes.
 */
async function getRunBreakdown(req, res) {
  const result = await quizService.getRunBreakdown(req.userId, req.params.boardId, req.params.quizId);
  return res.status(200).json(result);
}

/**
 * DELETE /boards/:boardId/quizzes — delete every quiz run on the board.
 */
async function removeAll(req, res) {
  const result = await quizService.removeAll(req.userId, req.params.boardId);
  return res.status(200).json(result);
}

module.exports = {
  generateQuestions: asyncHandler(generateQuestions),
  recordRun: asyncHandler(recordRun),
  recordRunFromSettings: asyncHandler(recordRunFromSettings),
  listAllRuns: asyncHandler(listAllRuns),
  listRuns: asyncHandler(listRuns),
  listRunsBySettings: asyncHandler(listRunsBySettings),
  getRunBreakdown: asyncHandler(getRunBreakdown),
  removeAll: asyncHandler(removeAll),
};
