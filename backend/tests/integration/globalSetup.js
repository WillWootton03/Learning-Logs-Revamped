require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Database } = require('../../db/pool');
const { getTestDatabaseUrl } = require('./helpers/testDb');

/**
 * Runs once before the integration suite: apply db/schema.sql to the test
 * database. Idempotent (IF NOT EXISTS), so repeated runs are safe.
 * Runs in a separate process from the tests, so .env is loaded here too.
 */
module.exports = async function globalSetup() {
  const pool = new Database({ connectionString: getTestDatabaseUrl() });
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8');
    await pool.query(schema);
  } finally {
    await pool.end();
  }
};
