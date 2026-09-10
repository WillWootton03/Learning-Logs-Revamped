/**
 * Unit tests for conceptService alternates handling.
 *
 * The new "alternate answers" feature adds a per-concept list of plausible
 * wrong answers used as multiple-choice distractors. These tests pin down the
 * service-level rules that protect that list: only strings (or pipe-separated
 * strings) are accepted, entries are trimmed and de-duplicated
 * case-insensitively, a per-row cap and a per-item length cap are enforced,
 * and an ABSENT field means "leave the list alone" while an empty array means
 * "clear it". The real Postgres behavior is covered by the integration suite.
 */
const conceptService = require('../../../services/conceptService');
const conceptRepository = require('../../../repositories/conceptRepository');
const { cache } = require('../../../services/cache');

jest.mock('../../../repositories/conceptRepository');
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

const VALID_UUID = '3b6f66a2-2d57-4a86-a6c9-6dbf2e6f1a11';
const CREATED = { concept_id: VALID_UUID, prompt: 'P', answer: 'A', alternates: [] };

describe('conceptService.create — alternates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    conceptRepository.create.mockResolvedValue(CREATED);
  });

  it('cleans a pipe-separated alternates string into trimmed, de-duplicated entries', async () => {
    await conceptService.create('user-1', VALID_UUID, {
      prompt: 'What is a closure?',
      answer: 'A function plus its lexical environment',
      alternates: ' A function returned from another function | a function returned from another function | ',
    });

    expect(conceptRepository.create).toHaveBeenCalledWith(
      'user-1',
      VALID_UUID,
      expect.objectContaining({
        alternates: ['A function returned from another function'],
      })
    );
  });

  it('deduplicates case-insensitively within an array input', async () => {
    await conceptService.create('user-1', VALID_UUID, {
      prompt: 'What is Big-O?',
      answer: 'A complexity bound',
      alternates: ['Describes time', 'describes time', 'Describes space'],
    });

    expect(conceptRepository.create).toHaveBeenCalledWith(
      'user-1',
      VALID_UUID,
      expect.objectContaining({
        alternates: ['Describes time', 'Describes space'],
      })
    );
  });

  it('treats an absent alternates field as an empty list', async () => {
    await conceptService.create('user-1', VALID_UUID, {
      prompt: 'What is a loop?',
      answer: 'A repeating construct',
    });

    expect(conceptRepository.create).toHaveBeenCalledWith(
      'user-1',
      VALID_UUID,
      expect.objectContaining({ alternates: [] })
    );
  });

  it('rejects a non-string, non-array alternates value with a 400', async () => {
    await expect(
      conceptService.create('user-1', VALID_UUID, {
        prompt: 'What is a loop?',
        answer: 'A repeating construct',
        alternates: 42,
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects more than 20 alternates with a 400', async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `alternate ${i}`);
    await expect(
      conceptService.create('user-1', VALID_UUID, {
        prompt: 'What is a loop?',
        answer: 'A repeating construct',
        alternates: tooMany,
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'alternates is limited to 20 answers',
    });
    expect(conceptRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an alternate longer than 500 characters with a 400', async () => {
    await expect(
      conceptService.create('user-1', VALID_UUID, {
        prompt: 'What is a loop?',
        answer: 'A repeating construct',
        alternates: ['x'.repeat(501)],
      })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('conceptService.update — alternates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    conceptRepository.update.mockResolvedValue(CREATED);
  });

  it('leaves the alternates list untouched when the field is absent', async () => {
    await conceptService.update('user-1', VALID_UUID, VALID_UUID, { prompt: 'Renamed' });

    expect(conceptRepository.update).toHaveBeenCalledWith(
      'user-1',
      VALID_UUID,
      VALID_UUID,
      expect.not.objectContaining({ alternates: expect.anything() })
    );
  });

  it('leaves the alternates list untouched when the field is null', async () => {
    await conceptService.update('user-1', VALID_UUID, VALID_UUID, {
      prompt: 'Renamed',
      alternates: null,
    });

    expect(conceptRepository.update).toHaveBeenCalledWith(
      'user-1',
      VALID_UUID,
      VALID_UUID,
      expect.not.objectContaining({ alternates: expect.anything() })
    );
  });

  it('replaces the whole list when given an explicit (even empty) array', async () => {
    await conceptService.update('user-1', VALID_UUID, VALID_UUID, {
      answer: 'A new answer',
      alternates: ['one', ' one ', 'TWO'],
    });

    expect(conceptRepository.update).toHaveBeenCalledWith(
      'user-1',
      VALID_UUID,
      VALID_UUID,
      expect.objectContaining({ alternates: ['one', 'TWO'] })
    );
  });

  it('still allows updating only the alternates list', async () => {
    await conceptService.update('user-1', VALID_UUID, VALID_UUID, { alternates: [] });

    expect(conceptRepository.update).toHaveBeenCalledWith(
      'user-1',
      VALID_UUID,
      VALID_UUID,
      { alternates: [] }
    );
  });
});

describe('conceptService.importMany — alternates column', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    conceptRepository.importMany.mockResolvedValue([]);
  });

  it('cleans a pipe-separated alternates cell per row before the batch insert', async () => {
    await conceptService.importMany('user-1', VALID_UUID, [
      {
        prompt: 'What is a variable?',
        answer: 'A named storage container',
        hint: null,
        alternates: 'a type that can change|A TYPE THAT CAN CHANGE',
        tags: ['js'],
      },
      {
        prompt: 'What is recursion?',
        answer: 'A function calling itself',
        hint: null,
        alternates: 'a loop|infinite repeats',
        tags: [],
      },
    ]);

    expect(conceptRepository.importMany).toHaveBeenCalledWith(
      'user-1',
      VALID_UUID,
      [
        expect.objectContaining({ alternates: ['a type that can change'] }),
        expect.objectContaining({ alternates: ['a loop', 'infinite repeats'] }),
      ]
    );
  });

  it('reports which import row failed validation in the error message', async () => {
    await expect(
      conceptService.importMany('user-1', VALID_UUID, [
        {
          prompt: 'What is a variable?',
          answer: 'A named storage container',
          alternates: { not: 'a list' },
          tags: [],
        },
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: 'Row 1: alternates must be an array of strings or a pipe-separated string',
    });
  });

  it('defaults missing alternates cells to empty lists', async () => {
    await conceptService.importMany('user-1', VALID_UUID, [
      {
        prompt: 'What is a variable?',
        answer: 'A named storage container',
        hint: null,
        tags: ['js'],
      },
    ]);

    expect(conceptRepository.importMany).toHaveBeenCalledWith(
      'user-1',
      VALID_UUID,
      [expect.objectContaining({ alternates: [] })]
    );
  });
});
