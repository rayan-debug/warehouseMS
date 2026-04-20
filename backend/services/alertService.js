const db = require('../config/db');

/**
 * Upserts an unread alert: updates the message if one already exists,
 * otherwise inserts a new one. Accepts any query executor so it can run
 * both inside a pg transaction client and against the default pool.
 *
 * @param {Function} exec  - db.query or client.query (bound)
 */
async function ensureAlert(exec, inventoryId, type, message) {
  const { rows } = await exec(
    `SELECT id FROM alerts
     WHERE inventory_id = $1 AND type = $2 AND is_read = false
     LIMIT 1`,
    [inventoryId, type]
  );
  if (rows[0]) {
    await exec(
      'UPDATE alerts SET message = $1, created_at = NOW() WHERE id = $2',
      [message, rows[0].id]
    );
  } else {
    await exec(
      'INSERT INTO alerts (inventory_id, type, message) VALUES ($1, $2, $3)',
      [inventoryId, type, message]
    );
  }
}

module.exports = { ensureAlert };
