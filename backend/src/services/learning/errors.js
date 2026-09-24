// Lightweight error carrying an HTTP status so services can signal 4xx cleanly; the
// controller copies `statusCode` onto res.status() before handing off to errorHandler.
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

module.exports = { HttpError };