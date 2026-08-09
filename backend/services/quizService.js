const quizRepository = require('../repositories/quizRepository');
const quizSettingsRepository = require('../repositories/quizSettingsRepository');
const conceptRepository = require('../repositories/conceptRepository');
const tagRepository = require('../repositories/tagRepository');
const { cache } = require('./cache');
const AppError = require('./AppError');
const { isUuid } = require('../utils/validate');
const { normalize, isLenientMatch, isExactMatch } = require('./matching');

const QUIZ_STYLES = ['true_false', 'multiple_choice', 'fill_in'];
const MCQ_OPTION_COUNT = 4; // 1 correct + 3 distractors
const MAX_QUESTIONS = 50;

/**
 * Fisher–Yates shuffle (returns a new array).
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Validate the quiz style.
 * @param {*} style
 * @returns {boolean}
 */
function validateStyle(style) {
  return typeof style === 'string' && QUIZ_STYLES.includes(style);
}

/**
 * Validate an optional tag filter: each id must be a well-formed UUID and
 * must exist on the user's board. Returns the ids or null.
 * @param {string} userId
 * @param {string} boardId
 * @param {*} tagIds
 * @returns {Promise<string[]|null>}
 * @throws {AppError} 400 on malformed/unknown ids.
 */
async function resolveTagIds(userId, boardId, tagIds) {
  if (tagIds === undefined || tagIds === null) return null;
  if (!Array.isArray(tagIds)) {
    throw new AppError(400, 'tagIds must be an array of UUIDs');
  }
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return null;
  for (const id of unique) {
    if (!isUuid(id)) {
      throw new AppError(400, 'tagIds must contain valid UUIDs');
    }
  }
  // One batch query validates every id against the board; any id that doesn't
  // come back means the caller supplied a foreign or fake tag.
  const found = await tagRepository.findByIds(userId, boardId, unique);
  if (found.length !== unique.length) {
    throw new AppError(400, 'One or more tags do not exist on this board');
  }
  return unique;
}

/**
 * Grab `count` random answers from the pool as distractors. Exactly `count`
 * iterations of Math.random — one per distractor, no loops over the pool.
 * Callers already verify the pool is large enough, so no edge handling.
 * @param {Array<object>} pool - All eligible concepts.
 * @param {number} count - Number of distractors wanted.
 * @returns {string[]}
 */
function pickDistractors(pool, count) {
  const distractors = [];
  for (let i = 0; i < count; i += 1) {
    distractors.push(pool[Math.floor(Math.random() * pool.length)].answer);
  }
  return distractors;
}

/**
 * Assemble the question payload for one concept in the requested style.
 * Multiple choice: 3 random distractors + the real answer, shuffled.
 * @param {string} style
 * @param {object} concept
 * @param {Array<object>} pool - All eligible concepts.
 * @returns {object}
 */
function buildQuestion(style, concept, pool) {
  const base = {
    conceptId: concept.concept_id,
    prompt: concept.prompt,
    hint: concept.hint,
  };
  if (style === 'fill_in') {
    return base;
  }
  if (style === 'multiple_choice') {
    const distractors = pickDistractors(pool, MCQ_OPTION_COUNT - 1);
    const options = shuffle([concept.answer, ...distractors]);
    return { ...base, options };
  }
  // true_false: show the real answer (expected: true) or a distractor
  // (expected: false) with 50/50 probability. The expected value is NOT sent
  // to the client; the client echoes back the statement it displayed and the
  // server recomputes correctness at scoring time.
  const [distractor] = pickDistractors(pool, 1);
  const useRealAnswer = distractor === undefined || Math.random() < 0.5;
  const statement = useRealAnswer ? concept.answer : distractor;
  return { ...base, statement };
}

/**
 * Score one submitted answer against the concept's real answer.
 * @param {string} style
 * @param {object} concept - Concept row (has .answer).
 * @param {{response: string|boolean, statement?: string}} answer
 * @param {boolean} exactMatching - When true, fill-in answers must match
 *   exactly (normalized) — no typo tolerance.
 * @returns {boolean}
 */
function scoreAnswer(style, concept, answer, exactMatching = false) {
  if (style === 'fill_in') {
    return exactMatching
      ? isExactMatch(concept.answer, answer.response)
      : isLenientMatch(concept.answer, answer.response);
  }
  if (style === 'multiple_choice') {
    return normalize(answer.response) === normalize(concept.answer);
  }
  if (style === 'true_false') {
    // Accept boolean true/false or the strings 'true'/'false'.
    const response = answer.response === true || answer.response === 'true';
    // correct iff the user's true/false judgment matches whether the shown
    // statement equals the real answer.
    return response === (normalize(answer.statement) === normalize(concept.answer));
  }
  return false;
}

/**
 * Generate questions for a quiz. Stateless: returns the questions (including
 * options/statements) for the client to display; no state is kept server-side.
 * @param {string} userId
 * @param {string} boardId
 * @param {{style: string, tagIds?: string[], includeKnown?: boolean, questionCount?: number, matchAll?: boolean}} params
 * @returns {Promise<Array<object>>}
 * @throws {AppError} 400 on invalid input, 404 if nothing eligible.
 */
async function generateQuestions(userId, boardId, { style, tagIds, includeKnown = false, questionCount, matchAll = false }) {
  if (!validateStyle(style)) {
    throw new AppError(400, `style must be one of: ${QUIZ_STYLES.join(', ')}`);
  }
  if (questionCount !== undefined && (!Number.isInteger(questionCount) || questionCount < 1)) {
    throw new AppError(400, 'questionCount must be a positive integer');
  }
  const resolvedTagIds = await resolveTagIds(userId, boardId, tagIds);
  const pool = await quizRepository.findEligibleConcepts(userId, boardId, {
    tagIds: resolvedTagIds,
    includeKnown,
    matchAll,
  });
  if (pool.length === 0) {
    throw new AppError(404, 'No concepts are eligible for this quiz');
  }
  const count = questionCount ? Math.min(questionCount, pool.length, MAX_QUESTIONS) : Math.min(pool.length, MAX_QUESTIONS);
  const selected = shuffle(pool).slice(0, count);
  return selected.map((concept) => buildQuestion(style, concept, pool));
}

/**
 * Persist a validated quiz run: score every answer server-side, insert the
 * run + per-question results in a transaction, and bump mastery for correct
 * concepts. Shared by recordRun and recordRunFromSettings so neither has to
 * re-validate what the other already did.
 * @param {string} userId
 * @param {string} boardId
 * @param {{
 *   quizSettingsId: string|null,
 *   style: string,
 *   timeElapsedMs: number,
 *   answers: Array<{conceptId: string, response: string|boolean, statement?: string}>,
 *   exactMatching?: boolean
 * }} data
 * @returns {Promise<{run: object, results: Array<object>}>}
 * @throws {AppError} 400 on unknown concepts.
 */
async function persistRun(userId, boardId, { quizSettingsId, style, timeElapsedMs, answers, exactMatching = false }) {
  const conceptIds = answers.map((a) => a.conceptId);
  for (const id of conceptIds) {
    if (!isUuid(id)) {
      throw new AppError(400, 'Each answer must reference a valid concept UUID');
    }
  }
  const concepts = await conceptRepository.findManyByIds(userId, boardId, conceptIds);
  const conceptById = new Map(concepts.map((c) => [c.concept_id, c]));
  if (concepts.length !== new Set(conceptIds).size) {
    throw new AppError(400, 'One or more concepts do not exist on this board');
  }

  const results = answers.map((answer) => {
    const concept = conceptById.get(answer.conceptId);
    return {
      conceptId: answer.conceptId,
      answeredCorrectly: scoreAnswer(style, concept, answer, exactMatching),
    };
  });

  const run = await quizRepository.createRun(userId, boardId, {
    quizSettingsId,
    timeElapsedMs,
    results,
  });
  // A run bumps mastery counters and adds a session, so the cached concept
  // list, this board's run list, and the user-wide activity-log runs are all
  // stale.
  await cache.invalidateBoard(userId, boardId);
  await cache.deleteKeys([cache.userKey(userId, 'runs')]);
  return { run, results };
}

/**
 * Record a completed one-off quiz run: validate the request, then persist.
 * @param {string} userId
 * @param {string} boardId
 * @param {{
 *   quizSettingsId?: string|null,
 *   style: string,
 *   timeElapsedMs: number,
 *   answers: Array<{conceptId: string, response: string|boolean, statement?: string}>
 * }} data
 * @returns {Promise<{run: object, results: Array<object>}>}
 * @throws {AppError} 400 on invalid input, 404 if settings missing.
 */
async function recordRun(userId, boardId, { quizSettingsId = null, style, timeElapsedMs, answers, exactMatching = false }) {
  if (!validateStyle(style)) {
    throw new AppError(400, `style must be one of: ${QUIZ_STYLES.join(', ')}`);
  }
  if (!Number.isInteger(timeElapsedMs) || timeElapsedMs < 0) {
    throw new AppError(400, 'timeElapsedMs must be a non-negative integer');
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new AppError(400, 'answers must be a non-empty array');
  }
  if (quizSettingsId !== null && !isUuid(quizSettingsId)) {
    throw new AppError(400, 'quizSettingsId must be a valid UUID');
  }
  if (quizSettingsId !== null) {
    const setting = await quizSettingsRepository.findById(userId, boardId, quizSettingsId);
    if (!setting) throw new AppError(404, 'Quiz settings not found');
  }
  return persistRun(userId, boardId, { quizSettingsId, style, timeElapsedMs, answers, exactMatching });
}

/**
 * Record a quiz run from a saved setting: the setting supplies the style and
 * the run is linked to it. The setting is fetched here once and reused, so
 * persistRun does not re-validate it.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} quizSettingsId
 * @param {{timeElapsedMs: number, answers: Array<object>}} data
 * @returns {Promise<{run: object, results: Array<object>}>}
 * @throws {AppError} 404 if the settings don't exist on the board.
 */
async function recordRunFromSettings(userId, boardId, quizSettingsId, { timeElapsedMs, answers }) {
  const setting = await quizSettingsRepository.findById(userId, boardId, quizSettingsId);
  if (!setting) throw new AppError(404, 'Quiz settings not found');
  return persistRun(userId, boardId, {
    quizSettingsId,
    style: setting.style,
    timeElapsedMs,
    answers,
    // The setting's persisted matching mode is authoritative — the client
    // never gets to override how its own run is scored.
    exactMatching: setting.exact_matching,
  });
}

/**
 * List all quiz runs for a user across every board, newest first. Used by the
 * activity log. Served from a user-scoped cache key; a miss hits Postgres and
 * repopulates. Written to invalidateBoard on every run creation.
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function listAllRuns(userId) {
  const key = cache.userKey(userId, 'runs');
  const cached = await cache.getJSON(key);
  if (cached) return cached;
  const rows = await quizRepository.findRunsByUser(userId);
  await cache.setJSON(key, rows);
  return rows;
}

/**
 * List all quiz runs for a board (one-offs and settings-linked). Served from
 * the 30-minute Redis cache; a miss hits Postgres and repopulates.
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<Array<object>>}
 */
async function listRuns(userId, boardId) {
  const key = cache.boardKey(userId, boardId, 'runs');
  const cached = await cache.getJSON(key);
  if (cached) return cached;
  const rows = await quizRepository.findRunsByBoard(userId, boardId);
  await cache.setJSON(key, rows);
  return rows;
}

/**
 * List quiz runs created from one saved setting.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} quizSettingsId
 * @returns {Promise<Array<object>>}
 * @throws {AppError} 404 if the settings don't exist on the board.
 */
async function listRunsBySettings(userId, boardId, quizSettingsId) {
  const setting = await quizSettingsRepository.findById(userId, boardId, quizSettingsId);
  if (!setting) throw new AppError(404, 'Quiz settings not found');
  return quizRepository.findRunsBySettings(userId, boardId, quizSettingsId);
}

/**
 * Delete every quiz run on a board (history). Verified against ownership via
 * the repo's SQL join.
 * @param {string} userId
 * @param {string} boardId
 * @returns {Promise<{deleted: number}>}
 */
async function removeAll(userId, boardId) {
  const deleted = await quizRepository.removeAll(userId, boardId);
  await cache.invalidateBoard(userId, boardId);
  return { deleted };
}

/**
 * Fetch a run summary plus its per-question breakdown. When the run was
 * created from a saved setting, also resolves that setting's tag filter to
 * names so the client can display it without extra calls.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} quizId
 * @returns {Promise<{run: object, questions: Array<object>}>}
 * @throws {AppError} 404 if the run is missing or not owned.
 */
async function getRunBreakdown(userId, boardId, quizId) {
  const run = await quizRepository.findRunById(userId, boardId, quizId);
  if (!run) throw new AppError(404, 'Quiz not found');
  const questions = await quizRepository.findQuestionsByRunId(userId, boardId, quizId);
  let tagNames = [];
  if (run.quiz_settings_id) {
    const tagIds = await quizSettingsRepository.findTagIds(userId, boardId, run.quiz_settings_id);
    if (tagIds.length > 0) {
      const tags = await tagRepository.findByIds(userId, boardId, tagIds);
      tagNames = tags.map((t) => t.name);
    }
  }
  run.tag_names = tagNames;
  return { run, questions };
}

module.exports = {
  generateQuestions,
  recordRun,
  recordRunFromSettings,
  listAllRuns,
  listRuns,
  listRunsBySettings,
  getRunBreakdown,
  removeAll,
};
