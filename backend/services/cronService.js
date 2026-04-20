const cron = require('node-cron');
const logger = require('../config/logger');
const db = require('../config/db');
const { ensureAlert } = require('./alertService');

let monitor = null;

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
