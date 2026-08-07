/**
 * Unit tests for the Upstash Redis cache wrapper (services/cache.js).
 *
 * @upstash/redis is mocked so no network is involved. Because Jest forces
 * NODE_ENV=test (which normally disables the cache), the module is re-required
 * in isolation with the Upstash env vars set and NODE_ENV cleared so the
 * client activates.
 */

const instances = [];

jest.mock('@upstash/redis', () => {
  class MockRedis {
    constructor(config) {
      this.config = config;
      this.store = new Map();
      this.setOptions = [];
      instances.push(this);
    }

    async get(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    }

    async set(key, value, opts) {
      this.store.set(key, value);
      this.setOptions.push(opts);
      return 'OK';
    }

    async del(...keys) {
      let deleted = 0;
      for (const key of keys) {
        if (this.store.delete(key)) deleted += 1;
      }
      return deleted;
    }
  }
  return { Redis: MockRedis };
});

const ORIGINAL_ENV = { ...process.env };

/** Freshly require cache.js with a cache-enabling environment. */
function loadCache() {
  process.env.NODE_ENV = 'development';
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  jest.resetModules();
  // eslint-disable-next-line global-require
  return require('../../../services/cache');
}

function restoreEnv() {
  for (const key of ['NODE_ENV', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
    if (key in ORIGINAL_ENV) {
      process.env[key] = ORIGINAL_ENV[key];
    } else {
      delete process.env[key];
    }
  }
}

afterAll(restoreEnv);

describe('cache', () => {
  test('constructs the client from the Upstash env vars with a 30-minute TTL', () => {
    const cache = loadCache();
    expect(instances).toHaveLength(1);
    expect(instances[0].config.url).toBe('https://example.upstash.io');
    expect(instances[0].config.token).toBe('test-token');
    expect(cache.CACHE_TTL_SECONDS).toBe(1800);
  });

  test('boardKey scopes keys by user, board, and resource', () => {
    const cache = loadCache();
    expect(cache.boardKey('user-1', 'board-1', 'concepts')).toBe('learninglogs:user-1:board-1:concepts');
  });

  test('setJSON stores JSON with the TTL and getJSON round-trips it', async () => {
    const cache = loadCache();
    const key = cache.boardKey('user-1', 'board-1', 'concepts');
    const rows = [{ concept_id: 'c1', prompt: 'hello', tags: ['a', 'b'] }];

    await cache.setJSON(key, rows);

    const redis = instances[instances.length - 1];
    expect(redis.store.get(key)).toBe(JSON.stringify(rows));
    expect(redis.setOptions).toEqual([{ ex: 1800 }]);
    expect(await cache.getJSON(key)).toEqual(rows);
  });

  test('getJSON returns null on a miss', async () => {
    const cache = loadCache();
    expect(await cache.getJSON(cache.boardKey('u', 'b', 'tags'))).toBeNull();
  });

  test('invalidateBoard deletes every board-scoped key', async () => {
    const cache = loadCache();
    const redis = instances[instances.length - 1];

    for (const resource of ['concepts', 'tags', 'logs', 'quizSettings', 'runs']) {
      redis.store.set(cache.boardKey('user-1', 'board-1', resource), '["x"]');
    }

    await cache.invalidateBoard('user-1', 'board-1');

    expect(redis.store.size).toBe(0);
  });

  test('is a no-op (no client, null hits) when the cache is disabled', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    jest.resetModules();
    // eslint-disable-next-line global-require
    const cache = require('../../../services/cache');
    const before = instances.length;

    expect(await cache.getJSON('anything')).toBeNull();
    await cache.setJSON('anything', { x: 1 });
    await cache.invalidateBoard('u', 'b');

    expect(instances).toHaveLength(before);
  });
});
