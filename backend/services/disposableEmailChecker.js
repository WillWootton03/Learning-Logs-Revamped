const disposableDomains = require('disposable-email-domains');
const disposableWildcardDomains = require('disposable-email-domains/wildcard.json');

/**
 * DisposableEmailChecker wraps the disposable-email-domains dataset so the rest
 * of the app talks to a small, stable API instead of the raw package.
 *
 * The package ships two lists:
 *   - an exact blocklist of ~120k disposable providers (e.g. mailinator.com)
 *   - a wildcard list of ~400 domains whose SUBdomains are also disposable
 *     (e.g. 10mail.org means foo.10mail.org is disposable too)
 *
 * Both are loaded once at construction and held in memory; the check is a
 * synchronous hash/suffix lookup with no network, so it is safe to call on the
 * registration and email-change paths without adding latency or I/O.
 */
class DisposableEmailChecker {
  constructor() {
    /** Exact-match providers, as a Set for O(1) lookups. */
    this.exactDomains = new Set(disposableDomains);
    /** Wildcard providers whose subdomains are also disposable. */
    this.wildcardDomains = disposableWildcardDomains;
  }

  /**
   * Pull the domain out of an email address, normalized to lowercase.
   * Returns null for non-string inputs or addresses without an '@'.
   * @param {*} email
   * @returns {string|null}
   */
  extractDomain(email) {
    if (typeof email !== 'string') return null;
    const at = email.lastIndexOf('@');
    if (at === -1) return null;
    const domain = email.slice(at + 1).trim().toLowerCase();
    return domain || null;
  }

  /**
   * True when the email's domain (or a parent of it) is on the disposable
   * blocklist. Invalid input returns false — the caller's own format check
   * owns malformed-email rejection.
   * @param {*} email
   * @returns {boolean}
   */
  isDisposable(email) {
    const domain = this.extractDomain(email);
    if (!domain) return false;
    if (this.exactDomains.has(domain)) return true;
    return this.wildcardDomains.some(
      (wildcard) => domain === wildcard || domain.endsWith(`.${wildcard}`)
    );
  }
}

const disposableEmailChecker = new DisposableEmailChecker();

module.exports = { DisposableEmailChecker, disposableEmailChecker };
