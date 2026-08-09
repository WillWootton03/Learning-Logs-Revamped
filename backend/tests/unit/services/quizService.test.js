/**
 * Unit tests for quizService run-listing cache behavior.
 *
 * Strategy: the quiz repository and the cache wrapper are mocked, so these
 * tests verify that the board-scoped run list and the user-wide activity feed
 * are served from Redis (cache hit -> no DB query), and fall through to
 * Postgres + repopulate on a miss.
 *
 * The real repository + database behavior is covered by the integration
 * tests (tests/integration/deleteAll.test.js etc.).
 */
const quizService = require('../../../services/quizService');
const quizRepository = require('../../../repositories/quizRepository');
const { cache } = require('../../../services/cache');

// Mock the repositories so no Postgres connection is involved.
jest.mock('../../../repositories/quizRepository');
// Mock the cache wrapper so tests control hit/miss explicitly and no Upstash
// connection is opened.
jest.mock('../../../services/cache', () => {
  const { CacheClient } = jest.requireActual('../../../services/cache');
  return {
    cache: {
      boardKey: jest.fn((userId, boardId, resource) => `learninglogs:${userId}:${boardId}:${resource}`),
      userKey: jest.fn((userId, resource) => `learninglogs:${userId}:all:${resource}`),
      getJSON: jest.fn(),
      setJSON: jest.fn(),
      invalidateBoard: jest.fn(),
      deleteKeys: jest.fn(),
    },
  };
});

const RUNS = [
  { quiz_id: 'run-1', correct_count: 4, questions_count: 5, created_at: new Date().toISOString() },
  { quiz_id: 'run-2', correct_count: 2, questions_count: 5, created_at: new Date().toISOString() },
];

describe('quizService.listRuns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves board runs from the cache on a hit without touching Postgres', async () => {
    cache.getJSON.mockResolvedValue(RUNS);

    const result = await quizService.listRuns('user-1', 'board-1');

    expect(cache.boardKey).toHaveBeenCalledWith('user-1', 'board-1', 'runs');
    expect(cache.getJSON).toHaveBeenCalledWith('learninglogs:user-1:board-1:runs', '/boards/:boardId/quizzes');
    expect(quizRepository.findRunsByBoard).not.toHaveBeenCalled();
    expect(cache.setJSON).not.toHaveBeenCalled();
    expect(result).toEqual(RUNS);
  });

  it('falls through to Postgres on a miss and repopulates the cache', async () => {
    cache.getJSON.mockResolvedValue(null);
    quizRepository.findRunsByBoard.mockResolvedValue(RUNS);

    const result = await quizService.listRuns('user-1', 'board-1');

    expect(quizRepository.findRunsByBoard).toHaveBeenCalledWith('user-1', 'board-1');
    expect(cache.setJSON).toHaveBeenCalledWith('learninglogs:user-1:board-1:runs', RUNS);
    expect(result).toEqual(RUNS);
  });
});

describe('quizService.listAllRuns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serves the user-wide activity feed from the cache on a hit', async () => {
    cache.getJSON.mockResolvedValue(RUNS);

    const result = await quizService.listAllRuns('user-1');

    expect(cache.userKey).toHaveBeenCalledWith('user-1', 'runs');
    expect(cache.getJSON).toHaveBeenCalledWith('learninglogs:user-1:all:runs', '/users/me/runs');
    expect(quizRepository.findRunsByUser).not.toHaveBeenCalled();
    expect(result).toEqual(RUNS);
  });

  it('falls through to Postgres on a miss and repopulates the cache', async () => {
    cache.getJSON.mockResolvedValue(null);
    quizRepository.findRunsByUser.mockResolvedValue(RUNS);

    const result = await quizService.listAllRuns('user-1');

    expect(quizRepository.findRunsByUser).toHaveBeenCalledWith('user-1');
    expect(cache.setJSON).toHaveBeenCalledWith('learninglogs:user-1:all:runs', RUNS);
    expect(result).toEqual(RUNS);
  });
});
