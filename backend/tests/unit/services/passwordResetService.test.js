/**
 * Unit tests for passwordResetService — emailed-link password reset with
 * DB-stored tokens.
 *
 * Strategy: authService, the user repository, the password-reset repository,
 * and the mailer are mocked. These tests verify that passwordResetService:
 *   - generates a random hex token (primary key of password_resets)
 *   - stores + emails a token for registered emails only, while answering
 *     identically for unknown emails (no user enumeration)
 *   - resolves a token to the user, hashes the new password, updates the
 *     user, and burns the token
 *   - rejects missing / invalid / expired tokens with 400
 *
 * The real repository + database behavior is covered by
 * tests/integration/passwordReset.test.js.
 */
const passwordResetService = require('../../../services/passwordResetService');
const authService = require('../../../services/authService');
const userRepository = require('../../../repositories/userRepository');
const passwordResetRepository = require('../../../repositories/passwordResetRepository');
const { mailer } = require('../../../services/mailer');

jest.mock('../../../services/authService');
jest.mock('../../../repositories/userRepository');
jest.mock('../../../repositories/passwordResetRepository');
jest.mock('../../../services/mailer', () => ({ mailer: { sendPasswordResetEmail: jest.fn() } }));

const USER = { user_id: 'user-1', email: 'ada@example.com' };

describe('passwordResetService.generateToken', () => {
  it('produces a 64-char hex string (256 bits of entropy)', () => {
    const token = passwordResetService.generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a unique token each call', () => {
    expect(passwordResetService.generateToken()).not.toBe(passwordResetService.generateToken());
  });
});

describe('passwordResetService.requestReset', () => {
  beforeEach(() => {
    userRepository.findByEmail.mockReset();
    passwordResetRepository.upsert.mockReset();
    mailer.sendPasswordResetEmail.mockReset();
  });

  it('stores a token and emails the reset link for a registered email', async () => {
    userRepository.findByEmail.mockResolvedValue(USER);

    const result = await passwordResetService.requestReset(' ADA@example.com ');

    expect(result).toEqual({ ok: true });
    expect(userRepository.findByEmail).toHaveBeenCalledWith('ada@example.com');
    // The upsert overwrites any previous token for the user (one link at a time).
    expect(passwordResetRepository.upsert).toHaveBeenCalledWith(
      'user-1',
      expect.stringMatching(/^[0-9a-f]{64}$/)
    );
    // The token goes out in the reset link.
    expect(mailer.sendPasswordResetEmail).toHaveBeenCalledWith(
      'ada@example.com',
      expect.objectContaining({ token: expect.stringMatching(/^[0-9a-f]{64}$/) })
    );
  });

  it('answers identically for an unknown email without storing or emailing', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    const result = await passwordResetService.requestReset('ghost@example.com');

    expect(result).toEqual({ ok: true });
    // No token write and no email leak the fact that the account doesn't exist.
    expect(passwordResetRepository.upsert).not.toHaveBeenCalled();
    expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('passwordResetService.resetPassword', () => {
  const ROW = { token: 'a'.repeat(64), user_id: 'user-1', requested_at: new Date() };

  beforeEach(() => {
    passwordResetRepository.findByToken.mockReset();
    passwordResetRepository.deleteByToken.mockReset();
    userRepository.updatePassword.mockReset();
    authService.hashPassword.mockReset();
    authService.hashPassword.mockResolvedValue('hashed-new-password');
  });

  it('updates the password hash, resolves the user via the token, and burns the token', async () => {
    passwordResetRepository.findByToken.mockResolvedValue(ROW);

    const result = await passwordResetService.resetPassword('a'.repeat(64), 'new-password-123');

    expect(result).toEqual({ ok: true });
    // The user at the token's user_id gets the new hash via the dedicated
    // credential-write query.
    expect(authService.hashPassword).toHaveBeenCalledWith('new-password-123');
    expect(userRepository.updatePassword).toHaveBeenCalledWith('user-1', 'hashed-new-password');
    // Single-use: the token is deleted after a successful reset.
    expect(passwordResetRepository.deleteByToken).toHaveBeenCalledWith('a'.repeat(64));
  });

  it('rejects with 400 when no token is provided', async () => {
    await expect(passwordResetService.resetPassword(undefined, 'new-pass')).rejects.toMatchObject({
      status: 400,
      code: 'RESET_TOKEN_REQUIRED',
    });
  });

  it('rejects with 400 when the token does not exist', async () => {
    passwordResetRepository.findByToken.mockResolvedValue(null);

    await expect(passwordResetService.resetPassword('b'.repeat(64), 'new-pass')).rejects.toMatchObject({
      status: 400,
      code: 'RESET_TOKEN_INVALID',
    });
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the token is expired (older than the TTL)', async () => {
    const old = new Date(Date.now() - passwordResetService.RESET_TTL_MS - 1000);
    passwordResetRepository.findByToken.mockResolvedValue({ ...ROW, requested_at: old });

    await expect(passwordResetService.resetPassword('a'.repeat(64), 'new-pass')).rejects.toMatchObject({
      status: 400,
      code: 'RESET_TOKEN_EXPIRED',
    });
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
    expect(passwordResetRepository.deleteByToken).not.toHaveBeenCalled();
  });
});
