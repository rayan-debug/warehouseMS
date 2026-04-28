// JWT-based auth middleware. Issues access + refresh tokens at login,
// guards routes via authenticate(), and gates by role via authorize().
const jwt = require('jsonwebtoken');

// Lazy-resolve secrets so .env loads first. Falls back to dev defaults.
const accessSecret  = () => process.env.JWT_SECRET          || 'warehousems-dev-secret';
const refreshSecret = () => process.env.JWT_REFRESH_SECRET  || process.env.JWT_SECRET || 'warehousems-dev-refresh';

// Sign a 1h access token embedding the user's identity + role.
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    accessSecret(),
    { expiresIn: '1h' }
  );
}

// Sign a 7d refresh token (id-only, no role) used to mint new access tokens.
function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    refreshSecret(),
    { expiresIn: '7d' }
  );
}

// Express middleware: require a valid Bearer token; populates req.user on success.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing access token.' });
  }

  try {
    req.user = jwt.verify(token, accessSecret());
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// Express middleware factory: only allow users whose role is in the given list.
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
    return next();
  };
}

module.exports = { authenticate, authorize, signToken, signRefreshToken, refreshSecret };
