const cron = require('node-cron');
const logger = require('../config/logger');
const db = require('../config/db');
const { ensureAlert } = require('./alertService');

// Background expiry-and-low-stock monitor. Runs once at boot and again at 06:00
// every day, raising 'expiry' alerts for items due within 30 days and 'low'
// alerts for items below their stock threshold.
let monitor = null;

// Scan inventory for items expiring in ≤30 days and items at/below threshold,
// then upsert alerts for each via ensureAlert().
async function runExpiryCheck() {
  const [{ rows: expiring }, { rows: lowStock }] = await Promise.all([
    db.query(`
      SELECT i.id AS inventory_id, p.name AS product_name,
             GREATEST(0, (i.expiry_date - CURRENT_DATE)::int) AS days_remaining
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.expiry_date IS NOT NULL
        AND i.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    `),
    db.query(`
      SELECT i.id AS inventory_id, p.name AS product_name
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.quantity <= i.threshold
    `),
  ]);

  for (const row of expiring) {
    await ensureAlert(
      db.query.bind(db),
      row.inventory_id,
      'expiry',
      `"${row.product_name}" expires in ${row.days_remaining} day(s).`
    );
  }
  for (const row of lowStock) {
    await ensureAlert(db.query.bind(db), row.inventory_id, 'low', `"${row.product_name}" is running low.`);
  }

  logger.info(`Expiry check: ${expiring.length} expiring, ${lowStock.length} low-stock item(s).`);
}

// Schedule the daily expiry check. Idempotent — calling twice has no effect.
function startExpiryMonitor() {
  if (monitor) return;

  runExpiryCheck().catch((err) =>
    logger.error(`Initial expiry check failed: ${err.message}`)
  );

  monitor = cron.schedule('0 6 * * *', () => {
    runExpiryCheck().catch((err) =>
      logger.error(`Expiry check failed: ${err.message}`)
    );
  });

  logger.info('Expiry monitor started (runs daily at 06:00).');
}

module.exports = { startExpiryMonitor, runExpiryCheck };
