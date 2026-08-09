const { Redis } = require('@upstash/redis');
const { logger } = require('./logger');

/**
 * Server-side read cache backed by Upstash Redis (REST).
 *
 * The board-level list endpoints (concepts, tags, logs, quiz settings, quiz
 * runs) are read far more often than they change, so their results are cached
 * for 30 minutes per (user, board). A cache miss — a first read, or a read
 * after the 30-minute TTL drops the entry — falls through to Postgres and
 * repopulates the cache.
 *
 * Every board-scoped write invalidates the whole board's keys (invalidateBoard),
 * so a list can never serve stale data after a mutation even though reads
 * within the TTL never touch the database.
 *
 * The cache fails open: any Redis error is logged and the caller proceeds
 * against Postgres, so an unavailable cache degrades to "no caching" rather
 * than taking the API down. It is also fully disabled in tests (NODE_ENV=test)
 * and whenever the Upstash credentials are missing.
 */

const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

/** The five list resources cached per board. */
const BOARD_RESOURCES = ['concepts', 'tags', 'logs', 'quizSettings', 'runs'];

class CacheClient {
  /**
   * @param {object} [config]
   * @param {string} [config.url] - Upstash REST URL.
   * @param {string} [config.token] - Upstash REST token.
   * @param {boolean} [config.enabled] - False disables the client (no Redis).
   * @param {number} [config.ttlSeconds] - Overrides the 30-minute default TTL.
   */
  constructor({ url, token, enabled, ttlSeconds = CACHE_TTL_SECONDS } = {}) {
    this.CACHE_TTL_SECONDS = ttlSeconds;
    this.redis = enabled && url && token ? new Redis({ url, token }) : null;
  }

  /** True when the underlying Redis client is active. */
  isEnabled() {
    return this.redis !== null;
  }

  /**
   * Cache key for one board-scoped list. The user id is part of the key so two
   * accounts can never read each other's cached rows, even on the same board id.
   * @param {string} userId
   * @param {string} boardId
   * @param {string} resource - One of BOARD_RESOURCES.
   * @returns {string}
   */
  boardKey(userId, boardId, resource) {
    return `learninglogs:${userId}:${boardId}:${resource}`;
  }

  /**
   * Cache key for a user-scoped resource that spans all boards (e.g. the
   * activity log's "all runs" list).
   * @param {string} userId
   * @param {string} resource
   * @returns {string}
   */
  userKey(userId, resource) {
    return `learninglogs:${userId}:all:${resource}`;
  }

  /**
   * Read a cached value. Returns null on a miss or any Redis failure.
   * Logs the lookup for Datadog: a hit/miss line with the route label the
   * caller attaches, so cache effectiveness can be tracked per endpoint.
   * @param {string} key
   * @param {string} [route] - API route label, e.g. '/boards/:boardId/concepts'.
   * @returns {Promise<*|null>}
   */
  async getJSON(key, route) {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (raw === null || raw === undefined) {
        logger.info('Cache lookup', { cache: { status: 'miss', route } });
        return null;
      }
      logger.info('Cache lookup', { cache: { status: 'hit', route } });
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    } catch (err) {
      logger.error(`[cache] get ${key} failed`, { cache: { status: 'error', route }, error: err.message });
      return null;
    }
  }

  /**
   * Store a value under a key with the TTL. Failures are logged and swallowed
   * (the caller already has the fresh data from Postgres).
   * @param {string} key
   * @param {*} value - Anything JSON-serializable.
   * @returns {Promise<void>}
   */
  async setJSON(key, value) {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), { ex: this.CACHE_TTL_SECONDS });
    } catch (err) {
      logger.error(`[cache] set ${key} failed`, { error: err.message });
    }
  }

  /**
   * Delete a set of keys.
   * @param {string[]} keys
   * @returns {Promise<void>}
   */
  async deleteKeys(keys) {
    if (!this.redis || keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      logger.error(`[cache] del ${keys.join(', ')} failed`, { error: err.message });
    }
  }

  /**
   * Drop every cached resource for a board. Called at the end of each board-
   * scoped write (create/update/delete/import), so the next list read rebuilds
   * from Postgres instead of serving pre-mutation data.
   * @param {string} userId
   * @param {string} boardId
   * @returns {Promise<void>}
   */
  async invalidateBoard(userId, boardId) {
    await this.deleteKeys(
      BOARD_RESOURCES.map((resource) => this.boardKey(userId, boardId, resource))
    );
  }
}

const cache = new CacheClient({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  enabled:
    process.env.NODE_ENV !== 'test' &&
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
});

module.exports = { CacheClient, cache, CACHE_TTL_SECONDS, BOARD_RESOURCES };
