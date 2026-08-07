const { Redis } = require('@upstash/redis');

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

const enabled =
  process.env.NODE_ENV !== 'test' &&
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

let redis = null;
if (enabled) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

/** The five list resources cached per board. */
const BOARD_RESOURCES = ['concepts', 'tags', 'logs', 'quizSettings', 'runs'];

/**
 * Cache key for one board-scoped list. The user id is part of the key so two
 * accounts can never read each other's cached rows, even on the same board id.
 * @param {string} userId
 * @param {string} boardId
 * @param {string} resource - One of BOARD_RESOURCES.
 * @returns {string}
 */
function boardKey(userId, boardId, resource) {
  return `learninglogs:${userId}:${boardId}:${resource}`;
}

/**
 * Read a cached value. Returns null on a miss or any Redis failure.
 * @param {string} key
 * @returns {Promise<*|null>}
 */
async function getJSON(key) {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    console.log('cache hit');
    return raw;
  } catch (err) {
    console.error(`[cache] get ${key} failed:`, err.message);
    return null;
  }
}

/**
 * Store a value under a key with the 30-minute TTL. Failures are logged and
 * swallowed (the caller already has the fresh data from Postgres).
 * @param {string} key
 * @param {*} value - Anything JSON-serializable.
 * @returns {Promise<void>}
 */
async function setJSON(key, value) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { ex: CACHE_TTL_SECONDS });
    console.log('cache set');
  } catch (err) {
    console.error(`[cache] set ${key} failed:`, err.message);
  }
}

/**
 * Delete a set of keys.
 * @param {string[]} keys
 * @returns {Promise<void>}
 */
async function deleteKeys(keys) {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
    console.log('cache del');
  } catch (err) {
    console.error(`[cache] del ${keys.join(', ')} failed:`, err.message);
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
async function invalidateBoard(userId, boardId) {
  await deleteKeys(BOARD_RESOURCES.map((resource) => boardKey(userId, boardId, resource)));
}

module.exports = {
  CACHE_TTL_SECONDS,
  BOARD_RESOURCES,
  boardKey,
  getJSON,
  setJSON,
  deleteKeys,
  invalidateBoard,
};
