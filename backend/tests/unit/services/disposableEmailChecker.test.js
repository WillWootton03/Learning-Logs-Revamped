/**
 * Unit tests for DisposableEmailChecker — the adapter over the
 * disposable-email-domains dataset.
 *
 * These use the real shipped blocklist (it's a static JSON dataset, no I/O),
 * so they pin the two behaviors the app depends on:
 *   - exact-match providers are caught (mailinator.com etc.)
 *   - wildcard providers catch their subdomains too (foo.10mail.org etc.)
 *   - legitimate providers (gmail.com, example.com) pass
 *   - malformed input is never "disposable" — the caller's format check owns
 *     malformed-email rejection
 */
const { DisposableEmailChecker } = require('../../../services/disposableEmailChecker');

describe('DisposableEmailChecker', () => {
  const checker = new DisposableEmailChecker();

  it('flags known disposable providers by exact domain match', () => {
    expect(checker.isDisposable('user@mailinator.com')).toBe(true);
    expect(checker.isDisposable('user@guerrillamail.com')).toBe(true);
  });

  it('flags subdomains of wildcard disposable domains', () => {
    // 10mail.org is in the wildcard list — any subdomain is disposable too.
    expect(checker.isDisposable('user@10mail.org')).toBe(true);
    expect(checker.isDisposable('user@foo.10mail.org')).toBe(true);
    expect(checker.isDisposable('user@deep.sub.10mail.org')).toBe(true);
  });

  it('does not flag legitimate providers', () => {
    expect(checker.isDisposable('user@gmail.com')).toBe(false);
    expect(checker.isDisposable('user@example.com')).toBe(false);
  });

  it('is case-insensitive on the domain', () => {
    expect(checker.isDisposable('user@MAILINATOR.COM')).toBe(true);
  });

  it('returns false for malformed input (never blocks on a format error)', () => {
    expect(checker.isDisposable('not-an-email')).toBe(false);
    expect(checker.isDisposable('user@')).toBe(false);
    expect(checker.isDisposable(null)).toBe(false);
    expect(checker.isDisposable(undefined)).toBe(false);
  });
});
