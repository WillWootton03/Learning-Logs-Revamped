/**
 * Unit tests for userService.
 *
 * Strategy: the user repository is mocked, so these tests verify userService's
 * business rules in isolation:
 *   - never leak password_hash to the API consumer
 *   - validate emails before hitting the DB
 *   - enforce email uniqueness (with a correct self-comparison for UUIDs)
 *   - map missing rows to 404, duplicates to 409
 *
 * The real repository + database behavior is covered by the integration tests
 * (tests/integration/users.test.js).
 */
const userService = require('../../../services/userService');
const userRepository = require('../../../repositories/userRepository');
const AppError = require('../../../services/AppError');

// Swap the repository for a jest.fn stand-in before userService is used.
jest.mock('../../../repositories/userRepository');
// The disposable-email checker is a static dataset lookup; mock it so these
// tests exercise userService's guard logic, not the blocklist itself (the
// checker has its own unit tests).
jest.mock('../../../services/disposableEmailChecker', () => ({
  disposableEmailChecker: { isDisposable: jest.fn(() => false) },
}));
const { disposableEmailChecker } = require('../../../services/disposableEmailChecker');

// A realistic raw DB row, including the sensitive columns the service must
// strip. Tests reuse this so each case focuses on its own assertion.
const RAW_USER = {
  user_id: 'user-1',
  email: 'ada@example.com',
  full_name: null,
  password_hash: 'hashed-password',
  email_verified: true,
  created_at: new Date().toISOString(),
};

describe('userService.getById', () => {
  it('returns the user with the password hash stripped', async () => {
    userRepository.findById.mockResolvedValue(RAW_USER);

    const result = await userService.getById('user-1');

    // Only the safe fields survive; hash must never leave the API. The profile
    // fields are included so the profile/settings pages can show the display
    // name and join date.
    expect(result).toEqual({
      user_id: 'user-1',
      email: 'ada@example.com',
      full_name: null,
      email_verified: true,
      created_at: RAW_USER.created_at,
    });
    expect(result.password_hash).toBeUndefined();
    // And the id is forwarded unchanged (it's a UUID string, not a number).
    expect(userRepository.findById).toHaveBeenCalledWith('user-1');
  });

  it('rejects with 404 when the user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(userService.getById('ghost')).rejects.toMatchObject({
      status: 404,
      name: AppError.name,
    });
  });
});

describe('userService.create', () => {
  beforeEach(() => {
    userRepository.findByEmail.mockReset();
    userRepository.create.mockReset();
    disposableEmailChecker.isDisposable.mockReset();
    disposableEmailChecker.isDisposable.mockReturnValue(false);
  });

  it('creates a user and returns only safe fields', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue('user-1');

    const result = await userService.create({
      email: 'ada@example.com',
      passwordHash: 'hashed-password',
    });

    expect(result).toEqual({
      user_id: 'user-1',
      email: 'ada@example.com',
      full_name: null,
    });
    // The hash is passed TO the repository (for storage) but the response is
    // stripped. No display name was provided, so it stays null.
    expect(userRepository.create).toHaveBeenCalledWith({
      email: 'ada@example.com',
      fullName: null,
      passwordHash: 'hashed-password',
    });
  });

  it('rejects with 400 for a malformed email', async () => {
    // Validation happens in the service, before any repo call.
    await expect(
      userService.create({ email: 'not-an-email', passwordHash: 'h' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects with 400 for a disposable email domain', async () => {
    disposableEmailChecker.isDisposable.mockReturnValue(true);

    await expect(
      userService.create({ email: 'spam@mailinator.com', passwordHash: 'h' })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Disposable email addresses are not allowed',
    });
    // Guard: a disposable address must never reach the DB.
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the email is already registered', async () => {
    userRepository.findByEmail.mockResolvedValue(RAW_USER);

    await expect(
      userService.create({ email: 'ada@example.com', passwordHash: 'h' })
    ).rejects.toMatchObject({ status: 409 });
    // Guard: a duplicate must never attempt the INSERT.
    expect(userRepository.create).not.toHaveBeenCalled();
  });
});

describe('userService.update', () => {
  beforeEach(() => {
    userRepository.findByEmail.mockReset();
    userRepository.update.mockReset();
    userRepository.findById.mockReset();
    disposableEmailChecker.isDisposable.mockReset();
    disposableEmailChecker.isDisposable.mockReturnValue(false);
  });

  it('updates an email and returns the refreshed safe user', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.update.mockResolvedValue({ user_id: 'user-1' });
    userRepository.findById.mockResolvedValue({
      ...RAW_USER,
      email: 'new@example.com',
    });

    const result = await userService.update('user-1', { email: 'new@example.com' });

    expect(result).toEqual({
      user_id: 'user-1',
      email: 'new@example.com',
      full_name: null,
      email_verified: true,
      created_at: RAW_USER.created_at,
    });
    // Partial update: only the email is sent; undefined fullName is dropped
    // by the repository's dynamic SET builder.
    expect(userRepository.update).toHaveBeenCalledWith('user-1', {
      fullName: undefined,
      email: 'new@example.com',
    });
  });

  it('rejects with 400 for a malformed email', async () => {
    await expect(userService.update('user-1', { email: 'nope' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects with 400 when the new email uses a disposable domain', async () => {
    disposableEmailChecker.isDisposable.mockReturnValue(true);

    await expect(
      userService.update('user-1', { email: 'new@tempmail.com' })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Disposable email addresses are not allowed',
    });
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('updates the full name and returns the refreshed safe user', async () => {
    userRepository.update.mockResolvedValue({ user_id: 'user-1' });
    userRepository.findById.mockResolvedValue({ ...RAW_USER, full_name: 'Ada Lovelace' });

    const result = await userService.update('user-1', { fullName: 'Ada Lovelace' });

    expect(result).toEqual({
      user_id: 'user-1',
      email: 'ada@example.com',
      full_name: 'Ada Lovelace',
      email_verified: true,
      created_at: RAW_USER.created_at,
    });
    expect(userRepository.update).toHaveBeenCalledWith('user-1', {
      fullName: 'Ada Lovelace',
      email: undefined,
    });
  });

  it('rejects with 409 when the email belongs to another user', async () => {
    // findByEmail returns a row owned by someone else -> the target email is
    // taken and the update must not proceed.
    userRepository.findByEmail.mockResolvedValue({ ...RAW_USER, user_id: 'someone-else' });

    await expect(userService.update('user-1', { email: 'ada@example.com' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('allows keeping the current email (same user_id)', async () => {
    // Updating your profile without changing the email must NOT be treated as
    // a duplicate. user_id is a UUID string, so the comparison is string
    // equality — this is the regression test for the old Number() bug that
    // produced NaN comparisons.
    userRepository.findByEmail.mockResolvedValue({ ...RAW_USER, user_id: 'user-1' });
    userRepository.update.mockResolvedValue({ user_id: 'user-1' });
    userRepository.findById.mockResolvedValue(RAW_USER);

    await expect(userService.update('user-1', { email: 'ada@example.com' })).resolves.toEqual({
      user_id: 'user-1',
      email: 'ada@example.com',
      full_name: null,
      email_verified: true,
      created_at: RAW_USER.created_at,
    });
  });

  it('rejects with 404 when the user is missing', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.update.mockResolvedValue(null);

    await expect(userService.update('ghost', { email: 'new@example.com' })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('userService.remove', () => {
  it('returns the deleted user id', async () => {
    userRepository.remove.mockResolvedValue(true);

    await expect(userService.remove('user-1')).resolves.toEqual({ user_id: 'user-1' });
  });

  it('rejects with 404 when the user is missing', async () => {
    userRepository.remove.mockResolvedValue(false);

    await expect(userService.remove('ghost')).rejects.toMatchObject({ status: 404 });
  });
});
