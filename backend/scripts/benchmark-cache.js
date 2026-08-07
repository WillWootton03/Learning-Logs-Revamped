/**
 * Benchmark: is the Upstash Redis read cache actually faster than Postgres?
 *
 * Measures, against the real database and real Upstash instance:
 *   1. Postgres list query (the exact query the concepts list endpoint runs)
 *   2. Redis SET  (the cache-miss write path)
 *   3. Redis GET  (the cache-hit read path)
 *   4. Full miss path (Postgres query + Redis SET — what a TTL expiry costs)
 *
 * Run from backend/ with the .env credentials in place:
 *   node scripts/benchmark-cache.js [iterations] [boardId]
 *
 * A board is auto-picked if none is given (the first board that has concepts).
 */

require('dotenv').config();

const { Redis } = require('@upstash/redis');
const pool = require('../db/pool');
const cache = require('../services/cache');

const ITERATIONS = Number(process.argv[2]) || 10;
const BOARD_ID = process.argv[3] || null;

const LIST_QUERY = `SELECT c.concept_id, c.prompt, c.answer, c.times_answered_correctly,
        COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.tag_id IS NOT NULL), '{}') AS tags
 FROM concepts c
 JOIN boards b ON b.board_id = c.board_id
 LEFT JOIN concept_tags ct ON ct.concept_id = c.concept_id
 LEFT JOIN tags t ON t.tag_id = ct.tag_id
 WHERE c.board_id = $1
 GROUP BY c.concept_id, c.prompt, c.answer, c.times_answered_correctly
 ORDER BY c.created_at`;

async function timeIt(label, fn) {
  const runs = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = process.hrtime.bigint();
    await fn();
    runs.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  runs.sort((a, b) => a - b);
  const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
  const p50 = runs[Math.floor(runs.length / 2)];
  const p95 = runs[Math.floor(runs.length * 0.95)];
  console.log(
    `${label.padEnd(38)} avg ${avg.toFixed(1).padStart(8)} ms | p50 ${p50.toFixed(1).padStart(8)} ms | p95 ${p95.toFixed(1).padStart(8)} ms | min ${runs[0].toFixed(1).padStart(7)} ms`
  );
  return { avg, p50, p95 };
}

(async () => {
  const cacheEnabled =
    process.env.NODE_ENV !== 'test' &&
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!cacheEnabled) {
    console.error('Cache is disabled — set UPSTASH_REDIS_REST_URL/TOKEN in .env (and not NODE_ENV=test).');
    process.exit(1);
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  // Pick a board (and its owner) that has concepts.
  let board;
  if (BOARD_ID) {
    const res = await pool.query(
      `SELECT b.board_id, b.user_id FROM boards b WHERE b.board_id = $1 LIMIT 1`,
      [BOARD_ID]
    );
    board = res.rows[0];
  } else {
    const res = await pool.query(
      `SELECT b.board_id, b.user_id
       FROM boards b
       WHERE EXISTS (SELECT 1 FROM concepts c WHERE c.board_id = b.board_id)
       ORDER BY b.created_at
       LIMIT 1`
    );
    board = res.rows[0];
  }
  if (!board) {
    console.error('No board with concepts found in the database.');
    process.exit(1);
  }

  const key = cache.boardKey(board.user_id, board.board_id, 'concepts');
  console.log(`Benchmarking board ${board.board_id} (${ITERATIONS} iterations each)\n`);

  // Warm Postgres + the pool's connection before timing.
  await pool.query(LIST_QUERY, [board.board_id]);

  const pg = await timeIt('Postgres list query (no cache)', async () => {
    await pool.query(LIST_QUERY, [board.board_id]);
  });

  // Cache-miss path: what the app does when the TTL has lapsed.
  const miss = await timeIt('Full miss (PG query + Redis SET)', async () => {
    const { rows } = await pool.query(LIST_QUERY, [board.board_id]);
    await redis.set(key, JSON.stringify(rows), { ex: cache.CACHE_TTL_SECONDS });
  });

  // Ensure a value is present, then time pure cache reads.
  await redis.set(key, JSON.stringify(['x']), { ex: cache.CACHE_TTL_SECONDS });
  const hit = await timeIt('Redis GET (cache hit)', async () => {
    await redis.get(key);
  });

  const write = await timeIt('Redis SET (cache write)', async () => {
    await redis.set(key, JSON.stringify(['x']), { ex: cache.CACHE_TTL_SECONDS });
  });

  await redis.del(key).catch(() => {});
  await pool.end();

  console.log('\n--- verdict ---');
  if (hit.avg < pg.avg) {
    const saving = ((pg.avg - hit.avg) / pg.avg) * 100;
    console.log(
      `Redis cache HIT is ${(pg.avg - hit.avg).toFixed(1)} ms faster than a Postgres list query (${saving.toFixed(0)}% saving).`
    );
    console.log(
      `But a MISS costs ${miss.avg.toFixed(1)} ms total (Postgres + Redis SET), and every L1-free read is a full REST round trip.`
    );
  } else {
    const penalty = ((hit.avg - pg.avg) / pg.avg) * 100;
    console.log(
      `Redis cache HIT is ${(hit.avg - pg.avg).toFixed(1)} ms SLOWER than a direct Postgres list query (+${penalty.toFixed(0)}%).`
    );
    console.log('The cache is currently costing more than it saves for reads.');
  }
  console.log(`\nNumbers are averages over ${ITERATIONS} runs (ms).`);
})();
