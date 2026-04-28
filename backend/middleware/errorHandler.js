// Final-fallback middleware for unmatched URLs — returns a 404 JSON envelope.
function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
}

// Express error-handling middleware: shapes any thrown/forwarded error into
// a uniform JSON response. Honors err.statusCode if set, defaults to 500.
function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
  });
}

module.exports = {
  errorHandler,
  notFound,
};
