const pool = require('../../../db/pool');

/**
 * Wipe all tables between tests. Truncating users cascades to every table
 * that references it (boards -> logs/concepts/tags/quiz_settings/quiz, and
 * the join tables), so one statement clears the whole schema.
 * @returns {Promise<void>}
 */
async function truncateAll() {
  await pool.query('TRUNCATE TABLE users CASCADE');
}

module.exports = { truncateAll };
