const bcrypt = require('bcryptjs');

/**
 * PasswordHasher wraps bcryptjs so password hashing/verification goes through
 * our own API. Holds the cost factor in one place — bumping it here (or via
 * the constructor) changes hashing everywhere without touching callers.
 */
class PasswordHasher {
  /**
   * @param {object} [config]
   * @param {number} [config.rounds] - bcrypt cost factor (default 10).
   */
  constructor({ rounds = 10 } = {}) {
    this.rounds = rounds;
  }

  /**
   * Hash a plaintext password with the configured cost factor.
   * @param {string} plaintext - Raw password from the client.
   * @returns {Promise<string>} The bcrypt hash to store in the DB.
   */
  hash(plaintext) {
    return bcrypt.hash(plaintext, this.rounds);
  }

  /**
   * Compare a plaintext password against a stored bcrypt hash.
   * @param {string} plaintext - Raw password from the login form.
   * @param {string} hash - Stored bcrypt hash.
   * @returns {Promise<boolean>} True when the password matches.
   */
  compare(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  }
}

const passwordHasher = new PasswordHasher();

module.exports = { PasswordHasher, passwordHasher };
