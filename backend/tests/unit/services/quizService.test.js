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
jest.mock('../../../repositories/conceptRepository');
jest.mock('../../../repositories/quizSettingsRepository');
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

const conceptRepository = require('../../../repositories/conceptRepository');
const quizSettingsRepository = require('../../../repositories/quizSettingsRepository');

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

// ---------------------------------------------------------------------------
// Alternate-answers + question-direction rules (the quizService unit rules).
//
// The helpers below are pure: given a concept and a pool they build/score one
// question. Randomness (which alternate is picked, which pool answer, whether
// a true/false statement is the real target) does not change the invariants
// these tests assert, so they are deterministic without seeding Math.random.
// ---------------------------------------------------------------------------

const UUID_A = 'a1b2c3d4-1111-4a5b-9c0d-e1f2a3b4c5d6';
const UUID_B = 'b1b2c3d4-2222-4a5b-9c0d-e1f2a3b4c5d6';
const UUID_C = 'c1b2c3d4-3333-4a5b-9c0d-e1f2a3b4c5d6';

/** One concept fixture. Alternates default to a generous clean list. */
function concept(id, prompt, answer, alternates = ['alt one', 'alt two', 'alt three', 'alt four', 'alt five']) {
  return { concept_id: id, prompt, answer, hint: null, alternates };
}

/** Pool big enough that random-with-replacement draws still stay inside it. */
function buildPool() {
  return [
    concept(UUID_A, 'What is X?', 'Answer X', ['wrong for x 1', 'wrong for x 2', 'wrong for x 3', 'wrong for x 4', 'wrong for x 5']),
    concept(UUID_B, 'What is Y?', 'Answer Y', []),
    concept(UUID_C, 'What is Z?', 'Answer Z', ['wrong for z only']),
    concept('d1b2c3d4-4444-4a5b-9c0d-e1f2a3b4c5d6', 'What is W?', 'Answer W'),
    concept('e1b2c3d4-5555-4a5b-9c0d-e1f2a3b4c5d6', 'What is V?', 'Answer V'),
  ];
}

describe('quizService.usableAlternates', () => {
  it('keeps only trimmed, non-blank, de-duplicated strings', () => {
    const out = quizService.usableAlternates(
      concept(UUID_A, 'p', 'real answer', [' a ', 'a', 'b', '', '   ', 'b', 42])
    );
    expect(out).toEqual(['a', 'b']);
  });

  it('drops alternates that normalize to the real answer', () => {
    const out = quizService.usableAlternates(
      concept(UUID_A, 'p', 'Real Answer', ['REAL ANSWER', 'real  answer', 'a fine wrong one'])
    );
    expect(out).toEqual(['a fine wrong one']);
  });

  it('tolerates a missing or non-array field', () => {
    const withoutField = { concept_id: UUID_A, prompt: 'p', answer: 'a', hint: null };
    expect(quizService.usableAlternates(withoutField)).toEqual([]);
    expect(quizService.usableAlternates({ ...withoutField, alternates: 'nope' })).toEqual([]);
  });
});

describe('quizService.pickDistinct', () => {
  it('returns the requested number of distinct items', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f'];
    const picked = quizService.pickDistinct(list, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });
});

describe('quizService.buildQuestion — multiple choice distractors', () => {
  it('uses alternates when at least 3 are usable, never the pool', () => {
    const pool = buildPool();
    const q = quizService.buildQuestion('multiple_choice', pool[0], pool, false);
    const allowed = new Set([...pool[0].alternates, pool[0].answer]);
    expect(q.reversed).toBe(false);
    expect(q.options).toHaveLength(4);
    expect(q.options).toContain(pool[0].answer);
    for (const opt of q.options) {
      expect(allowed.has(opt)).toBe(true);
    }
  });

  it('falls back to pool answers when fewer than 3 alternates are usable', () => {
    const pool = buildPool();
    // Two alternates only — below the 3-option cutoff, so they must NOT show.
    const few = concept(UUID_A, 'What is X?', 'Answer X', ['zalt-one', 'zalt-two']);
    const q = quizService.buildQuestion('multiple_choice', few, pool, false);
    const altSet = new Set(few.alternates);
    expect(q.options).toHaveLength(4);
    expect(q.options).toContain('Answer X');
    for (const opt of q.options) {
      expect(altSet.has(opt)).toBe(false);
    }
  });

  it('in reversed mode draws every option from pool prompts, never alternates', () => {
    const pool = buildPool();
    const q = quizService.buildQuestion('multiple_choice', pool[0], pool, true);
    const promptSet = new Set(pool.map((c) => c.prompt));
    const altSet = new Set(pool[0].alternates);
    expect(q.reversed).toBe(true);
    expect(q.options).toHaveLength(4);
    expect(q.options).toContain('What is X?');
    for (const opt of q.options) {
      expect(promptSet.has(opt)).toBe(true);
      expect(altSet.has(opt)).toBe(false);
    }
  });
});

describe('quizService.buildQuestion — true/false statements', () => {
  it('forward statements come from the answer side of the pool', () => {
    const pool = buildPool();
    const q = quizService.buildQuestion('true_false', pool[0], pool, false);
    const answers = new Set(pool.map((c) => c.answer));
    expect(answers.has(q.statement)).toBe(true);
  });

  it('reversed statements come from the prompt side of the pool', () => {
    const pool = buildPool();
    const q = quizService.buildQuestion('true_false', pool[0], pool, true);
    const prompts = new Set(pool.map((c) => c.prompt));
    expect(prompts.has(q.statement)).toBe(true);
    expect(q.reversed).toBe(true);
  });
});

describe('quizService.scoreAnswer — reversed orientation', () => {
  const forward = buildPool()[0]; // answer: "Answer X", prompt: "What is X?"

  it('fill_in forward compares to the answer; reversed compares to the prompt', () => {
    expect(quizService.scoreAnswer('fill_in', forward, { response: 'answer x' }, false, false)).toBe(true);
    // Far-apart response so the lenient (typo-tolerance) matcher can't rescue it.
    expect(quizService.scoreAnswer('fill_in', forward, { response: 'purple monkey dishwasher' }, false, false)).toBe(false);
    // Forward: the prompt is NOT accepted as a correct answer.
    expect(quizService.scoreAnswer('fill_in', forward, { response: 'What is X?' }, false, false)).toBe(false);
    expect(quizService.scoreAnswer('fill_in', forward, { response: 'what is x?' }, false, true)).toBe(true);
    expect(quizService.scoreAnswer('fill_in', forward, { response: 'Answer X' }, false, true)).toBe(false);
  });

  it('fill_in exact matching still honours the reversed target', () => {
    expect(quizService.scoreAnswer('fill_in', forward, { response: 'What is X?' }, true, true)).toBe(true);
    expect(quizService.scoreAnswer('fill_in', forward, { response: 'what is x' }, true, true)).toBe(false);
  });

  it('multiple_choice forward matches the answer only', () => {
    expect(quizService.scoreAnswer('multiple_choice', forward, { response: 'Answer X' }, false, false)).toBe(true);
    expect(quizService.scoreAnswer('multiple_choice', forward, { response: 'wrong for x 1' }, false, false)).toBe(false);
  });

  it('multiple_choice reversed matches the prompt only', () => {
    expect(quizService.scoreAnswer('multiple_choice', forward, { response: 'What is X?' }, false, true)).toBe(true);
    expect(quizService.scoreAnswer('multiple_choice', forward, { response: 'Answer X' }, false, true)).toBe(false);
  });

  it('true_false judges the statement against the reversed target', () => {
    // Forward: statement IS the answer -> judging it true is correct.
    expect(
      quizService.scoreAnswer('true_false', forward, { response: true, statement: 'Answer X' }, false, false)
    ).toBe(true);
    expect(
      quizService.scoreAnswer('true_false', forward, { response: true, statement: 'Answer Y' }, false, false)
    ).toBe(false);
    // Reversed: statement IS the prompt -> true is correct; any other prompt -> false.
    expect(
      quizService.scoreAnswer('true_false', forward, { response: true, statement: 'What is X?' }, false, true)
    ).toBe(true);
    expect(
      quizService.scoreAnswer('true_false', forward, { response: true, statement: 'What is Y?' }, false, true)
    ).toBe(false);
    expect(
      quizService.scoreAnswer('true_false', forward, { response: 'false', statement: 'What is X?' }, false, true)
    ).toBe(false);
  });
});

describe('quizService.generateQuestions — reversed validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a non-boolean reversed flag with a 400 before touching the DB', async () => {
    quizRepository.findEligibleConcepts.mockResolvedValue(buildPool());
    await expect(
      quizService.generateQuestions('user-1', 'board-1', { style: 'multiple_choice', reversed: 'yes' })
    ).rejects.toMatchObject({ status: 400, message: 'reversed must be a boolean' });
    expect(quizRepository.findEligibleConcepts).not.toHaveBeenCalled();
  });

  it('stamps reversed onto every generated question payload', async () => {
    const pool = buildPool();
    quizRepository.findEligibleConcepts.mockResolvedValue(pool);
    const questions = await quizService.generateQuestions('user-1', 'board-1', {
      style: 'fill_in',
      questionCount: pool.length,
      reversed: true,
    });
    expect(questions.length).toBe(pool.length);
    for (const q of questions) {
      expect(q.reversed).toBe(true);
    }
  });
});

describe('quizService.recordRun — reversed scoring wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    quizRepository.createRun.mockResolvedValue({ quiz_id: 'run-1', reversed: true });
  });

  it('rejects a non-boolean reversed flag with a 400', async () => {
    await expect(
      quizService.recordRun('user-1', 'board-1', {
        style: 'fill_in',
        timeElapsedMs: 1000,
        answers: [{ conceptId: UUID_A, response: 'anything' }],
        reversed: 'yes',
      })
    ).rejects.toMatchObject({ status: 400, message: 'reversed must be a boolean' });
    expect(quizRepository.createRun).not.toHaveBeenCalled();
  });

  it('scores multiple-choice answers against the prompt when reversed', async () => {
    // findManyByIds must answer only with the requested subset — persistRun
    // treats any extra/missing row as a foreign concept.
    conceptRepository.findManyByIds.mockImplementation(async (_userId, _boardId, ids) =>
      buildPool().filter((c) => ids.includes(c.concept_id))
    );

    const { results } = await quizService.recordRun('user-1', 'board-1', {
      style: 'multiple_choice',
      timeElapsedMs: 1200,
      answers: [
        { conceptId: UUID_A, response: 'What is X?' },
        { conceptId: UUID_B, response: 'Answer Y' },
      ],
      reversed: true,
    });

    expect(results).toEqual([
      { conceptId: UUID_A, answeredCorrectly: true },
      { conceptId: UUID_B, answeredCorrectly: false },
    ]);
    expect(quizRepository.createRun).toHaveBeenCalledWith(
      'user-1',
      'board-1',
      expect.objectContaining({ reversed: true })
    );
    expect(cache.invalidateBoard).toHaveBeenCalledWith('user-1', 'board-1');
  });
});

describe('quizService.recordRunFromSettings — direction comes from the setting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    quizRepository.createRun.mockResolvedValue({ quiz_id: 'run-1' });
    quizSettingsRepository.findById.mockResolvedValue({
      quiz_settings_id: 'settings-1',
      style: 'multiple_choice',
      exact_matching: false,
      reversed: true,
    });
  });

  it('scores using the setting-reversed flag, not a client override', async () => {
    conceptRepository.findManyByIds.mockImplementation(async (_userId, _boardId, ids) =>
      buildPool().filter((c) => ids.includes(c.concept_id))
    );

    const { results } = await quizService.recordRunFromSettings('user-1', 'board-1', 'settings-1', {
      timeElapsedMs: 800,
      answers: [{ conceptId: UUID_A, response: 'What is X?' }],
    });

    expect(results).toEqual([{ conceptId: UUID_A, answeredCorrectly: true }]);
    expect(quizRepository.createRun).toHaveBeenCalledWith(
      'user-1',
      'board-1',
      expect.objectContaining({ reversed: true })
    );
  });
});
