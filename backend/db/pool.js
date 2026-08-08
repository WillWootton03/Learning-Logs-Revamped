const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

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

// Session settings published for RLS, mapped from the identity context keys
// that runAsUser / runWithContext accept. Published with set_config(..., true)
// so each value only lives for the current transaction and can never leak
// across pooled connections.
const CONTEXT_SETTINGS = [
  ['userId', 'app.current_user_id'],
  ['email', 'app.current_email'],
  ['resetToken', 'app.current_reset_token'],
];

function hasContext(ctx) {
  return Boolean(ctx) && CONTEXT_SETTINGS.some(([key]) => ctx[key]);
}

/**
 * Publish the identity context to the client for the current transaction.
 * @param {import('pg').PoolClient} client
 * @param {object|null} ctx - e.g. { userId }, { email }, { resetToken }.
 */
async function applyContext(client, ctx) {
  if (!ctx) return;
  for (const [key, setting] of CONTEXT_SETTINGS) {
    if (ctx[key]) {
      await client.query('SELECT set_config($1, $2, true)', [setting, String(ctx[key])]);
    }
  }
}

/**
 * Database is our own wrapper around the pg.Pool.
 *
 * Every repository query runs through this single pool so connections are
 * reused instead of opened per request. The class exposes only the operations
 * the app actually uses instead of leaking pg's whole surface.
 *
 * Identity context: authenticate() runs each request inside userContext with
 * the authenticated user's id (see runAsUser). Database.query then runs the
 * query inside a short transaction that first publishes the context with
 * set_config, so the row-level-security policies in db/schema.sql see the
 * current user and enforce ownership at the database layer. With no context,
 * RLS filters everything out — the fail-closed default.
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
   * Run a query, scoped by whatever identity context is active. When a context
   * exists the query runs inside a short transaction that publishes it first,
   * so RLS policies see the current user. Without a context the query runs
   * as-is and RLS filters everything out (fail closed).
   * @param {string} text - SQL, with $1/$2… placeholders.
   * @param {Array} [params] - Values bound to the placeholders.
   * @returns {Promise<import('pg').QueryResult>}
   */
  async query(text, params) {
    const ctx = userContext.getStore();
    if (!hasContext(ctx)) {
      return this.pool.query(text, params);
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await applyContext(client, ctx);
      const result = await client.query(text, params);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Run fn(client) inside a transaction. The active identity context is
   * published right after BEGIN, so RLS also applies to every statement the
   * transaction performs.
   * @param {(client: import('pg').PoolClient) => Promise<any>} fn
   * @returns {Promise<any>} Whatever fn resolves to.
   */
  async transaction(fn) {
    const ctx = userContext.getStore();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await applyContext(client, ctx);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Run fn with a user id published as the RLS context. Async context
   * propagation means every await inside fn (and, when used in middleware,
   * every downstream handler) inherits the context.
   * @param {string} userId - The current user's id (UUID).
   * @param {Function} fn
   * @returns {Promise<any>}
   */
  runAsUser(userId, fn) {
    return userContext.run({ userId }, fn);
  }

  /**
   * Run fn with an arbitrary identity context — { userId }, { email }, or
   * { resetToken }. Used by the pre-login auth flows, where the user isn't
   * known yet and the policy must match on the address or the emailed reset
   * token instead.
   * @param {object} context
   * @param {Function} fn
   * @returns {Promise<any>}
   */
  runWithContext(context, fn) {
    return userContext.run(context, fn);
  }

  /**
   * Check out a client for manual transaction control. The caller owns
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

// Request-scoped identity. authenticate() runs the request inside this store
// with the authenticated user's id; Database.query picks it up and publishes
// it to the DB session so RLS can enforce ownership.
const userContext = new AsyncLocalStorage();

const pool = new Database();

module.exports = { Database, pool, userContext };
