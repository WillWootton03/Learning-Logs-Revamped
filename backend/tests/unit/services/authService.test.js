/**
 * Unit tests for authService.
 *
 * Strategy: every external dependency (bcrypt, jwt, and the user repository)
 * is mocked. These tests verify that authService calls its dependencies
 * correctly and enforces the right status codes — they do NOT test the real
 * implementations of hashing or JWT.
 *
 * Why mock everything?
 *   - Speed: real bcrypt hashing takes ~100ms per call; a mock is instant.
 *   - Determinism: bcrypt salts are random and real JWTs are long strings, so
 *     output differs every run. Mocks return fixed values we control.
 *   - Isolation: if a test fails, it means authService's own logic is broken,
 *     not that a dependency misbehaved.
 *
 * The real end-to-end behavior is covered separately by the integration tests
 * (tests/integration/auth.test.js).
 */

// Set env vars BEFORE importing authService — it reads these at require time.
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authService = require('../../../services/authService');
const userRepository = require('../../../repositories/userRepository');
const AppError = require('../../../services/AppError');

// jest.mock is hoisted above the requires, so the mocks are in place before
// authService is loaded. authService therefore captures the MOCKED versions
// of these modules when it does its own require — that's the whole trick.
jest.mock('bcryptjs'); // every export becomes a jest.fn()
jest.mock('jsonwebtoken');
jest.mock('../../../repositories/userRepository');

describe('authService.hashPassword', () => {
  it('hashes a plaintext password with a salt factor of 10', async () => {
    // Program the mock: any call to bcrypt.hash resolves to a fixed value.
    // We don't care about real hashing here, only that authService forwards
    // the plaintext and the cost factor.
    bcrypt.hash.mockResolvedValue('hashed-value');
    // Call the unit under test and unwrap its promise.
    await expect(authService.hashPassword('secret')).resolves.toBe('hashed-value');
    // The important assertion: hashPassword must call bcrypt.hash with
    // (plaintext, 10). If someone changed the salt factor, this fails even
    // though the mock still returns 'hashed-value'.
    expect(bcrypt.hash).toHaveBeenCalledWith('secret', 10);
  });
});

describe('authService.verifyPassword', () => {
  it('delegates to bcrypt.compare', async () => {
    // Same pattern: verifyPassword should be a thin wrapper over bcrypt.compare.
    bcrypt.compare.mockResolvedValue(true);
    await expect(authService.verifyPassword('secret', 'stored-hash')).resolves.toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'stored-hash');
  });
});

describe('authService.signTokens', () => {
  it('signs an access token that expires in 1h and a refresh token in 30d', () => {
    // jwt.sign is mocked with an implementation that echoes the payload +
    // expiry, so we can assert on both the TTL and the token shape without
    // depending on real JWT output.
    jwt.sign.mockImplementation((payload, secret, opts) => `token:${payload.userId}:${opts.expiresIn}`);

    const { accessToken, refreshToken } = authService.signTokens('user-1', 1);

    // Sanity-check the returned tokens encode the user id and correct TTLs.
    expect(accessToken).toBe('token:user-1:1h');
    expect(refreshToken).toBe('token:user-1:30d');
    // Critical contract: the two tokens are signed with DIFFERENT secrets, so
    // a leaked access token can't be used to mint refresh tokens.
    // jwtid is a random id that makes each token unique; expect.any(String)
    // checks the option exists without pinning a specific value.
    // Both tokens embed passwordIt so a password change revokes them.
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: 'user-1', passwordIt: 1 },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '1h', jwtid: expect.any(String) }
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: 'user-1', passwordIt: 1 },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '30d', jwtid: expect.any(String) }
    );
  });

  it('gives every minted token a distinct jwtid across calls', () => {
    // jwt.sign is mocked, but crypto.randomUUID() is NOT — signTokens uses the
    // real implementation, so the ids it forwards are genuinely unique UUIDs.
    // This is the assertion expect.any(String) can't make: uniqueness.
    jwt.sign.mockImplementation((payload, secret, opts) => `token:${payload.userId}:${opts.expiresIn}`);
    jwt.sign.mockClear(); // only count calls from this test

    // Two separate signings, as would happen on login then refresh.
    authService.signTokens('user-1', 1);
    authService.signTokens('user-1', 1);

    // Each signTokens call signs two tokens (access + refresh), so four
    // jwt.sign calls. Pull the jwtid out of each call's options object.
    const jwtids = jwt.sign.mock.calls.map(([, , opts]) => opts.jwtid);

    expect(jwtids).toHaveLength(4);
    // A Set drops duplicates: if any two tokens shared an id the sizes would
    // differ, which is exactly the "refresh mints a new token" guarantee.
    expect(new Set(jwtids).size).toBe(jwtids.length);
  });
});

describe('authService.signAccessToken', () => {
  it('signs a 1h access token with the access secret and a unique jwtid', () => {
    jwt.sign.mockImplementation((payload, secret, opts) => `token:${payload.userId}:${opts.expiresIn}`);

    const token = authService.signAccessToken('user-1', 1);

    // Only an access token is minted here (the refresh route's whole job), and
    // it must use the access secret + 1h TTL with a per-token jwtid.
    expect(token).toBe('token:user-1:1h');
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: 'user-1', passwordIt: 1 },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '1h', jwtid: expect.any(String) }
    );
  });

  it('mints a distinct access token on every call (fresh token per refresh)', () => {
    // crypto.randomUUID() is NOT mocked, so the forwarded jwtids are real
    // unique UUIDs — this is the property a refresh depends on.
    jwt.sign.mockImplementation((payload, secret, opts) => `token:${payload.userId}:${opts.expiresIn}`);
    jwt.sign.mockClear();

    authService.signAccessToken('user-1');
    authService.signAccessToken('user-1');

    const jwtids = jwt.sign.mock.calls.map(([, , opts]) => opts.jwtid);
    expect(jwtids).toHaveLength(2);
    expect(new Set(jwtids).size).toBe(jwtids.length);
  });
});

describe('authService.verifyAccessToken', () => {
  it('verifies against the access secret', () => {
    jwt.verify.mockReturnValue({ userId: 'user-1' });
    expect(authService.verifyAccessToken('tok')).toEqual({ userId: 'user-1' });
    // The access token must only ever be verified with the access secret.
    expect(jwt.verify).toHaveBeenCalledWith('tok', process.env.JWT_ACCESS_SECRET);
  });

  it('propagates expiry/invalid errors', () => {
    // jwt.verify throws on bad/expired tokens; verifyAccessToken must let that
    // error propagate (the authenticate middleware turns it into a 401).
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    expect(() => authService.verifyAccessToken('bad')).toThrow('jwt expired');
  });
});

describe('authService.verifyRefreshToken', () => {
  it('verifies against the refresh secret', () => {
    jwt.verify.mockReturnValue({ userId: 'user-1' });
    expect(authService.verifyRefreshToken('tok')).toEqual({ userId: 'user-1' });
    expect(jwt.verify).toHaveBeenCalledWith('tok', process.env.JWT_REFRESH_SECRET);
  });
});

describe('authService.loginWithPassword', () => {
  // loginWithPassword uses findByEmail + bcrypt.compare; reset both between
  // tests so mockResolvedValue settings don't leak across cases.
  beforeEach(() => {
    bcrypt.compare.mockReset();
    userRepository.findByEmail.mockReset();
  });

  it('returns the user row for valid credentials', async () => {
    const row = {
      user_id: 'user-1',
      email: 'a@b.com',
      password_hash: 'stored-hash',
      password_it: 1,
      email_verified: true,
    };
    userRepository.findByEmail.mockResolvedValue(row);
    bcrypt.compare.mockResolvedValue(true);

    await expect(authService.loginWithPassword('a@b.com', 'secret')).resolves.toBe(row);
  });

  it('rejects with 401 when the user is unknown', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    // AppError carries a status; toMatchObject checks status + name so a 500
    // or a generic Error would fail the test.
    await expect(authService.loginWithPassword('ghost@b.com', 'secret')).rejects.toMatchObject({
      status: 401,
      name: AppError.name,
    });
  });

  it('rejects with 401 when the account has no password hash', async () => {
    // Accounts should always have a password now that Google OAuth is gone,
    // but a missing hash (e.g. a legacy row) must still yield the same 401 as
    // wrong credentials — no info leak about which account exists.
    userRepository.findByEmail.mockResolvedValue({
      user_id: 'user-1',
      email: 'a@b.com',
      password_hash: null,
    });

    await expect(authService.loginWithPassword('a@b.com', 'secret')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects with 401 when the password is wrong', async () => {
    userRepository.findByEmail.mockResolvedValue({
      user_id: 'user-1',
      email: 'a@b.com',
      password_hash: 'stored-hash',
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.loginWithPassword('a@b.com', 'wrong')).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('authService.validatePasswordStrength', () => {
  it('accepts a password meeting every requirement', () => {
    expect(() => authService.validatePasswordStrength('Password123!')).not.toThrow();
  });

  it('rejects a password that is 8 characters or shorter', () => {
    // Exactly 8 chars — the policy demands "longer than 8".
    expect(() => authService.validatePasswordStrength('Pass1!aa')).toThrow(
      expect.objectContaining({ status: 400, message: 'Password must be longer than 8 characters' })
    );
  });

  it('rejects a password without an uppercase letter', () => {
    expect(() => authService.validatePasswordStrength('password123!')).toThrow(
      expect.objectContaining({ status: 400, message: 'Password must contain at least one capital letter' })
    );
  });

  it('rejects a password without a special character', () => {
    expect(() => authService.validatePasswordStrength('Password123')).toThrow(
      expect.objectContaining({ status: 400, message: 'Password must contain at least one special character' })
    );
  });
});
