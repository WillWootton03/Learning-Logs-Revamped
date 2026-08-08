const { Database } = require('../../../db/pool');
const { getTestDatabaseAdminUrl } = require('./testDb');

/**
 * Admin connection for test cleanup. TRUNCATE requires table ownership, which
 * the restricted app role the suites exercise does not have (and RLS would
 * filter a DELETE anyway), so truncation always runs as the owner role.
 */
const adminPool = new Database({ connectionString: getTestDatabaseAdminUrl() });

/**
 * Wipe all tables between tests. Truncating users cascades to every table
 * that references it (boards -> logs/concepts/tags/quiz_settings/quiz, and
 * the join tables), so one statement clears the whole schema.
 * @returns {Promise<void>}
 */
async function truncateAll() {
  await adminPool.query('TRUNCATE TABLE users CASCADE');
}

module.exports = { truncateAll };
