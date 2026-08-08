require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Database } = require('../../db/pool');
const { getTestDatabaseAdminUrl } = require('./helpers/testDb');

/**
 * Runs once before the integration suite: apply db/schema.sql to the test
 * database. Idempotent (IF NOT EXISTS), so repeated runs are safe.
 * Runs in a separate process from the tests, so .env is loaded here too.
 *
 * DDL must run as the admin/owner role (TEST_DATABASE_ADMIN_URL) — the app
 * role the suites exercise cannot run schema changes.
 */
module.exports = async function globalSetup() {
  const pool = new Database({ connectionString: getTestDatabaseAdminUrl() });
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8');
    await pool.query(schema);
  } finally {
    await pool.end();
  }
};
