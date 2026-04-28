const { validationResult } = require('express-validator');

// Aggregates express-validator results from earlier chain handlers; returns
// a 422 with the first error message if any check failed, else passes through.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const first = errors.array()[0];
  return res.status(422).json({
    success: false,
    message: first.msg,
    errors: errors.array(),
  });
}

module.exports = { validate };
