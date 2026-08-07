const { pool } = require('../db/pool');
const AppError = require('../services/AppError');

// Summary columns for list; detail (get-by-id) additionally returns board_id,
// created_at, and the linked setting's fields. The quiz table has no
// updated_at, so the detail row's timestamp is created_at.
const RUN_LIST_COLUMNS =
  'q.quiz_id, q.quiz_settings_id, q.questions_count, q.time_elapsed_ms, q.correct_count, q.created_at';
const RUN_COLUMNS =
  'q.quiz_id, q.board_id, q.quiz_settings_id, q.questions_count, q.time_elapsed_ms, q.correct_count, q.created_at';

/**
 * Fetch the concepts eligible for a quiz on a board: optionally filtered to a
 * set of tags, and (unless includeKnown is set) excluding concepts that have
 * already reached the board's mastery threshold. This pool is used both to
 * build questions and to source distractors.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {{tagIds: string[]|null, includeKnown: boolean, matchAll?: boolean}} opts
 * @returns {Promise<Array<object>>} Concept rows (concept_id, prompt, answer, hint).
 */
async function findEligibleConcepts(userId, boardId, { tagIds, includeKnown, matchAll = false }) {
  const result = await pool.query(
    `SELECT DISTINCT c.concept_id, c.prompt, c.answer, c.hint
     FROM concepts c
     JOIN boards b ON b.board_id = c.board_id
     LEFT JOIN concept_tags ct ON ct.concept_id = c.concept_id
     WHERE c.board_id = $1
       AND b.user_id = $2
       AND (
         $3::uuid[] IS NULL
         OR (
           $5::boolean AND (
             SELECT COUNT(*) FROM concept_tags ct2
             WHERE ct2.concept_id = c.concept_id AND ct2.tag_id = ANY($3::uuid[])
           ) = CARDINALITY($3::uuid[])
         )
         OR (NOT $5::boolean AND ct.tag_id = ANY($3::uuid[]))
       )
       AND ($4::boolean OR c.times_answered_correctly < b.mastery_threshold)`,
    [boardId, userId, tagIds && tagIds.length ? tagIds : null, includeKnown, matchAll]
  );
  return result.rows;
}

/**
 * Record a completed quiz run inside a transaction: insert the quiz row and
 * its per-question rows, then bump times_answered_correctly for concepts the
 * user got right. All-or-nothing.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {{
 *   quizSettingsId: string|null,
 *   timeElapsedMs: number,
 *   results: Array<{conceptId: string, answeredCorrectly: boolean}>
 * }} data
 * @returns {Promise<object>} Created quiz row (with quiz_id).
 */
async function createRun(userId, boardId, { quizSettingsId, timeElapsedMs, results }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quizResult = await client.query(
      `INSERT INTO quiz (board_id, quiz_settings_id, questions_count, time_elapsed_ms, correct_count)
       SELECT $1, $2, $3, $4, $5
       FROM boards b
       WHERE b.board_id = $1 AND b.user_id = $6
       RETURNING quiz_id, quiz_settings_id, questions_count, time_elapsed_ms, correct_count`,
      [
        boardId,
        quizSettingsId,
        results.length,
        timeElapsedMs,
        results.filter((r) => r.answeredCorrectly).length,
        userId,
      ]
    );
    const quiz = quizResult.rows[0];
    // The INSERT is guarded by a board-ownership check, so no row means the
    // board doesn't exist or isn't the user's — fail loudly rather than
    // crashing on quiz.quiz_id below.
    if (!quiz) {
      throw new AppError(404, 'Board not found or not owned');
    }

    // quiz_id is the same for every row, so it's bound once ($1) and the
    // per-row values are expanded with parallel unnest arrays.
    const conceptIds = results.map((r) => r.conceptId);
    const positions = results.map((_, i) => i + 1);
    const answeredCorrectly = results.map((r) => r.answeredCorrectly);
    await client.query(
      `INSERT INTO quiz_questions (quiz_id, concept_id, position, answered_correctly)
       SELECT $1, unnest($2::uuid[]), unnest($3::int[]), unnest($4::boolean[])`,
      [quiz.quiz_id, conceptIds, positions, answeredCorrectly]
    );

    const correctIds = results.filter((r) => r.answeredCorrectly).map((r) => r.conceptId);

    if (correctIds.length > 0) {
      await client.query(
        `UPDATE concepts c
         SET times_answered_correctly = c.times_answered_correctly + 1
         FROM boards b
         WHERE c.concept_id = ANY($1::uuid[])
           AND c.board_id = b.board_id
           AND b.board_id = $2
           AND b.user_id = $3`,
        [correctIds, boardId, userId]
      );
    }

    await client.query('COMMIT');
    return quiz;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List all quiz runs for a board, newest first.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<Array<object>>} Run rows with settings_name.
 */
async function findRunsByBoard(userId, boardId) {
  const result = await pool.query(
    `SELECT ${RUN_LIST_COLUMNS}, qs.name AS settings_name
     FROM quiz q
     JOIN boards b ON b.board_id = q.board_id
     LEFT JOIN quiz_settings qs ON qs.quiz_settings_id = q.quiz_settings_id
     WHERE q.board_id = $1 AND b.user_id = $2
     ORDER BY q.created_at DESC`,
    [boardId, userId]
  );
  return result.rows;
}

/**
 * List quiz runs created from a specific saved setting.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} quizSettingsId - Settings id (UUID).
 * @returns {Promise<Array<object>>} Run rows.
 */
async function findRunsBySettings(userId, boardId, quizSettingsId) {
  const result = await pool.query(
    `SELECT ${RUN_LIST_COLUMNS}, qs.name AS settings_name
     FROM quiz q
     JOIN boards b ON b.board_id = q.board_id
     JOIN quiz_settings qs ON qs.quiz_settings_id = q.quiz_settings_id
     WHERE q.board_id = $1 AND b.user_id = $2 AND q.quiz_settings_id = $3
     ORDER BY q.created_at DESC`,
    [boardId, userId, quizSettingsId]
  );
  return result.rows;
}

/**
 * Fetch a single run, verifying it belongs to the user's board. Also pulls in
 * the linked setting's name and flags so a run detail can show what was asked.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} quizId - Run id (UUID).
 * @returns {Promise<object|null>} Run row or null.
 */
async function findRunById(userId, boardId, quizId) {
  const result = await pool.query(
    `SELECT ${RUN_COLUMNS}, qs.name AS settings_name, qs.include_known, qs.exact_matching, qs.match_all_tags
     FROM quiz q
     JOIN boards b ON b.board_id = q.board_id
     LEFT JOIN quiz_settings qs ON qs.quiz_settings_id = q.quiz_settings_id
     WHERE q.quiz_id = $1 AND q.board_id = $2 AND b.user_id = $3`,
    [quizId, boardId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Fetch the per-question results of a run in original ask order, including
 * the concept's prompt/answer/hint and tag names for the review breakdown.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @param {string} quizId - Run id (UUID).
 * @returns {Promise<Array<object>>} Question result rows.
 */
async function findQuestionsByRunId(userId, boardId, quizId) {
  const result = await pool.query(
    `SELECT qq.quiz_question_id, qq.position, qq.answered_correctly,
            c.concept_id, c.prompt, c.answer, c.hint,
            COALESCE(ARRAY_AGG(t.name ORDER BY t.name) FILTER (WHERE t.tag_id IS NOT NULL), '{}') AS tags
     FROM quiz_questions qq
     JOIN quiz q ON q.quiz_id = qq.quiz_id
     JOIN boards b ON b.board_id = q.board_id
     JOIN concepts c ON c.concept_id = qq.concept_id
     LEFT JOIN concept_tags ct ON ct.concept_id = c.concept_id
     LEFT JOIN tags t ON t.tag_id = ct.tag_id
     WHERE qq.quiz_id = $1 AND q.board_id = $2 AND b.user_id = $3
     GROUP BY qq.quiz_question_id, qq.position, qq.answered_correctly, c.concept_id, c.prompt, c.answer, c.hint
     ORDER BY qq.position`,
    [quizId, boardId, userId]
  );
  return result.rows;
}

/**
 * Delete every quiz run on a board, joined through boards so only the owner's
 * runs are removed. quiz_questions cascade.
 * @param {string} userId - Board owner's user id (UUID).
 * @param {string} boardId - Board id (UUID).
 * @returns {Promise<number>} Number of runs deleted.
 */
async function removeAll(userId, boardId) {
  const result = await pool.query(
    `DELETE FROM quiz q
     USING boards b
     WHERE q.board_id = b.board_id
       AND b.board_id = $1
       AND b.user_id = $2`,
    [boardId, userId]
  );
  return result.rowCount;
}

module.exports = {
  findEligibleConcepts,
  createRun,
  findRunsByBoard,
  findRunsBySettings,
  findRunById,
  findQuestionsByRunId,
  removeAll,
};
