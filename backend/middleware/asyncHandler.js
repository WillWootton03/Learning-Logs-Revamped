/**
 * Wrap an async route handler so any rejected promise is forwarded to
 * Express's error middleware. Express 4 does not catch async errors
 * on its own — without this, a rejection would hang the request.
 * @param {Function} fn - Async handler: (req, res, next) => Promise.
 * @returns {Function} Express-compatible middleware.
 */
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
