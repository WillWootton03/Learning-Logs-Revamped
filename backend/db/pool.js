const { Pool } = require('pg');

const databaseUrl =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/learninglogs';

/**
 * Decide whether TLS is needed. Neon's connection strings ask for it
 * (sslmode=require); local Postgres usually doesn't. Honoring the string's
 * own sslmode is the most robust signal — and neon.tech hosts are a fallback.
 */
const needsSsl = /sslmode=require/i.test(databaseUrl) || /neon\.tech/i.test(databaseUrl);

/**
 * Shared PostgreSQL connection pool. Every repository query runs through
 * this single pool so connections are reused instead of opened per request.
 * Configured via DATABASE_URL (see .env), with a sensible local default.
 * SSL is applied automatically for Neon; local dev connects in plaintext.
 */
const pool = new Pool({
  connectionString: databaseUrl,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

module.exports = pool;
