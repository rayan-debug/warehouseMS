const db = require('../config/db');

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
