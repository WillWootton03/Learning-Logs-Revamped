const { Pool } = require('pg');

const databaseUrl =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/learninglogs';

/**
 * Decide whether TLS is needed. Neon's connection strings ask for it
 * (sslmode=require); local Postgres usually doesn't. Honoring the string's
 * own sslmode is the most robust signal — and neon.tech hosts are a fallback.
 */
function needsSsl(connectionString) {
  return /sslmode=require/i.test(connectionString) || /neon\.tech/i.test(connectionString);
}

/**
 * Database is our own wrapper around the pg.Pool.
 *
 * Every repository query runs through this single pool so connections are
 * reused instead of opened per request. The class exposes only the operations
 * the app actually uses (query/connect/end) instead of leaking pg's whole
 * surface, so swapping the underlying driver later means changing one file.
 *
 * Configured via DATABASE_URL (see .env), with a sensible local default.
 * SSL is applied automatically for Neon; local dev connects in plaintext.
 */
class Database {
  /**
   * @param {object} [config]
   * @param {string} [config.connectionString] - Postgres URL. Defaults to
   *   DATABASE_URL, falling back to a local learninglogs database.
   */
  constructor({ connectionString = databaseUrl } = {}) {
    this.connectionString = connectionString;
    this.pool = new Pool({
      connectionString,
      ...(needsSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {}),
    });
  }

  /**
   * Run a query on the pool.
   * @param {string} text - SQL, with $1/$2… placeholders.
   * @param {Array} [params] - Values bound to the placeholders.
   * @returns {Promise<import('pg').QueryResult>}
   */
  query(text, params) {
    return this.pool.query(text, params);
  }

  /**
   * Check out a client for a transaction. The caller is responsible for
   * BEGIN/COMMIT and releasing the client (client.release()).
   * @returns {Promise<import('pg').PoolClient>}
   */
  connect() {
    return this.pool.connect();
  }

  /** Close every idle connection. Used by scripts/tests on shutdown. */
  end() {
    return this.pool.end();
  }
}

const pool = new Database();

module.exports = { Database, pool };
