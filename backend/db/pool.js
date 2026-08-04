const { Pool } = require('pg');

/**
 * Shared PostgreSQL connection pool. Every repository query runs through
 * this single pool so connections are reused instead of opened per request.
 * Configured via DATABASE_URL (see .env), with a sensible local default.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/learninglogs',
});

module.exports = pool;
