/**
 * Unit tests for passwordService.changePassword — changing a signed-in user's
 * password (distinct from the forgotten-password reset flow).
 *
 * Strategy: authService and the user repository are mocked, so these tests
 * verify passwordService's business rules in isolation:
 *   - the current password must be present and verified against the stored hash
 *   - the new password is hashed and written via the dedicated
 *     userRepository.updatePassword() credential query
 *   - accounts without a stored hash can't change one
 *   - missing fields / wrong current password map to 400 / 401
 *
 * The real repository + database behavior is covered by
 * tests/integration/users.test.js (PUT /users/me/password).
 */
const passwordService = require('../../../services/passwordService');
const authService = require('../../../services/authService');
const userRepository = require('../../../repositories/userRepository');

jest.mock('../../../services/authService');
jest.mock('../../../repositories/userRepository');

const USER = {
  user_id: 'user-1',
  email: 'ada@example.com',
  full_name: null,
  password_hash: 'hashed-old-password',
  email_verified: true,
};

describe('passwordService.changePassword', () => {
  beforeEach(() => {
    userRepository.findById.mockReset();
    userRepository.updatePassword.mockReset();
    authService.verifyPassword.mockReset();
    authService.hashPassword.mockReset();
    authService.verifyPassword.mockResolvedValue(true);
    authService.hashPassword.mockResolvedValue('hashed-new-password');
    // updatePassword returns the incremented version so the controller can
    // re-issue tokens bound to the new password_it.
    userRepository.updatePassword.mockResolvedValue({ user_id: 'user-1', password_it: 2 });
  });

  it('verifies the current password, hashes the new one, and writes via updatePassword', async () => {
    userRepository.findById.mockResolvedValue(USER);

    const result = await passwordService.changePassword('user-1', 'old-pass', 'new-pass');

    // The incremented password_it is returned so the caller can re-issue
    // cookies for the current session (all others are revoked).
    expect(result).toEqual({ user_id: 'user-1', password_it: 2 });
    // The current password is checked against the stored hash first...
    expect(authService.verifyPassword).toHaveBeenCalledWith('old-pass', 'hashed-old-password');
    // ...then the new password is hashed and persisted through the dedicated
    // credential-write query (never the profile update path).
    expect(authService.hashPassword).toHaveBeenCalledWith('new-pass');
    expect(userRepository.updatePassword).toHaveBeenCalledWith('user-1', 'hashed-new-password');
  });

  it('rejects with 400 when either password field is missing', async () => {
    await expect(passwordService.changePassword('user-1', undefined, 'new-pass')).rejects.toMatchObject({
      status: 400,
    });
    await expect(passwordService.changePassword('user-1', 'old-pass', undefined)).rejects.toMatchObject({
      status: 400,
    });
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the account has no password', async () => {
    userRepository.findById.mockResolvedValue({ ...USER, password_hash: null });

    await expect(passwordService.changePassword('user-1', 'old-pass', 'new-pass')).rejects.toMatchObject({
      status: 400,
    });
    expect(authService.verifyPassword).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the current password is wrong', async () => {
    userRepository.findById.mockResolvedValue(USER);
    authService.verifyPassword.mockResolvedValue(false);

    await expect(passwordService.changePassword('user-1', 'wrong-pass', 'new-pass')).rejects.toMatchObject({
      status: 401,
    });
    // A failed verification must never reach the write.
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects with 404 when the user row vanishes mid-change', async () => {
    userRepository.findById.mockResolvedValue(USER);
    userRepository.updatePassword.mockResolvedValue(null);

    await expect(passwordService.changePassword('user-1', 'old-pass', 'new-pass')).rejects.toMatchObject({
      status: 404,
    });
  });
});
