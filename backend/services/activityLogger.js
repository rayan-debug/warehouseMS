const db = require('../config/db');

// Append-only audit log helper. Errors are swallowed by design — logging
// must never fail the user's actual request (e.g., a sale, a login).
async function logActivity(userId, action, details = null, ip = null) {
  try {
    await db.query(
      'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, action, details, ip]
    );
  } catch {
    // non-fatal — never block the main request
  }
}

module.exports = { logActivity };
