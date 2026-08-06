/**
 * Error type that carries an HTTP status code alongside its message.
 * Services throw these to tell the controller what to respond with
 * (e.g. 404 for missing users, 409 for duplicate email). The error
 * middleware in app.js converts them into JSON responses.
 */
class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    // Machine-readable code (e.g. 'EMAIL_NOT_VERIFIED') so the client can
    // branch on the failure without parsing human-readable messages.
    this.code = code;
    this.name = 'AppError';
  }
}

module.exports = AppError;
