const { validationResult } = require('express-validator');

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
