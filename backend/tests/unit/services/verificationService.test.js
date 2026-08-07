/**
 * Unit tests for verificationService — email verification via stateless JWT
 * codes.
 *
 * Strategy: jwt, the user repository, and the mailer are mocked. These tests
 * verify that verificationService:
 *   - signs tokens with the email secret, an expiry, and a unique jwtid
 *   - rejects malformed/expired tokens with 400
 *   - issues a code (respecting the resend cooldown) and emails it
 *   - never stores anything — only userRepository.setEmailVerified persists.
 */
process.env.JWT_EMAIL_SECRET = 'test-email-secret';

const jwt = require('jsonwebtoken');
const verificationService = require('../../../services/verificationService');
const userRepository = require('../../../repositories/userRepository');
const { mailer } = require('../../../services/mailer');
const AppError = require('../../../services/AppError');

jest.mock('jsonwebtoken');
jest.mock('../../../repositories/userRepository');
jest.mock('../../../services/mailer', () => ({ mailer: { sendVerificationEmail: jest.fn() } }));

describe('verificationService.generateToken', () => {
  it('signs a token with the email secret, an expiry, and a unique jwtid', () => {
    jwt.sign.mockImplementation((payload, secret, opts) => `token:${payload.sub}:${opts.expiresIn}`);

    const token = verificationService.generateToken('user-1');

    expect(token).toBe('token:user-1:24h');
    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: 'user-1' },
      process.env.JWT_EMAIL_SECRET,
      { expiresIn: '24h', jwtid: expect.any(String) }
    );
  });
});

describe('verificationService.verifyToken', () => {
  it('returns the user id embedded in a valid token', () => {
    jwt.verify.mockReturnValue({ sub: 'user-1' });
    expect(verificationService.verifyToken('good-token')).toBe('user-1');
    expect(jwt.verify).toHaveBeenCalledWith('good-token', process.env.JWT_EMAIL_SECRET);
  });

  it('rejects with 400 when the token is missing', () => {
    expect(() => verificationService.verifyToken(undefined)).toThrow(
      expect.objectContaining({ status: 400, code: 'TOKEN_REQUIRED' })
    );
  });

  it('rejects with 400 when the token is malformed or expired', () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    expect(() => verificationService.verifyToken('expired')).toThrow(
      expect.objectContaining({ status: 400, code: 'TOKEN_INVALID' })
    );
  });
});

describe('verificationService.issueToken', () => {
  const UNVERIFIED_USER = {
    user_id: 'user-1',
    email: 'ada@example.com',
    email_verified: false,
  };

  beforeEach(() => {
    userRepository.findById.mockReset();
    mailer.sendVerificationEmail.mockReset();
    userRepository.findById.mockResolvedValue(UNVERIFIED_USER);
  });

  it('emails a code and returns the email + cooldown', async () => {
    jwt.sign.mockReturnValue('signed-code');

    const result = await verificationService.issueToken('user-1');

    expect(result).toEqual({ email: 'ada@example.com', resendAfterMs: 60000 });
    // The code goes out to the user's address.
    expect(mailer.sendVerificationEmail).toHaveBeenCalledWith('ada@example.com', {
      code: 'signed-code',
    });
    // Nothing is persisted for the code itself — no OTP write, only the email.
    expect(userRepository.setEmailVerified).not.toHaveBeenCalled();
  });

  it('skips the cooldown when force is set (first send)', async () => {
    jwt.sign.mockReturnValue('signed-code');
    await verificationService.issueToken('user-1', { force: true });
    await verificationService.issueToken('user-1', { force: true });
    expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(2);
  });

  it('rejects with 429 during the resend cooldown', async () => {
    jwt.sign.mockReturnValue('signed-code');
    // force bypasses the check on the first send; the immediate second send is
    // inside the 60s cooldown window.
    await verificationService.issueToken('user-1', { force: true });

    await expect(verificationService.issueToken('user-1')).rejects.toMatchObject({
      status: 429,
      code: 'VERIFY_COOLDOWN',
    });
  });

  it('rejects with 400 when the email is already verified', async () => {
    userRepository.findById.mockResolvedValue({ ...UNVERIFIED_USER, email_verified: true });
    await expect(verificationService.issueToken('user-1')).rejects.toMatchObject({
      status: 400,
      code: 'EMAIL_ALREADY_VERIFIED',
    });
  });

  it('rejects with 404 when the user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(verificationService.issueToken('ghost')).rejects.toMatchObject({
      status: 404,
      name: AppError.name,
    });
  });
});
