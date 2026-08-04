/**
 * Error type that carries an HTTP status code alongside its message.
 * Services throw these to tell the controller what to respond with
 * (e.g. 404 for missing users, 409 for duplicate email). The error
 * middleware in app.js converts them into JSON responses.
 */
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}

module.exports = AppError;
