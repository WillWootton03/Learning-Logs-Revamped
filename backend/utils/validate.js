const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check whether a value is a well-formed UUID string.
 * @param {*} value
 * @returns {boolean}
 */
function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

module.exports = { isUuid };
