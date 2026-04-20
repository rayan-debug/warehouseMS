require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const logger = require('../config/logger');

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    logger.error('DATABASE_URL is required. Configure backend/.env first.');
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    logger.info('Resetting tables…');
    await client.query(
      'TRUNCATE sale_items, sales, alerts, inventory, products, users, categories RESTART IDENTITY CASCADE'
    );

    // ── Categories ──────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO categories (name) VALUES ('Dairy'), ('Bakery'), ('Produce'), ('Beverages')
    `);
    const { rows: cats } = await client.query('SELECT id, name FROM categories ORDER BY id');
    const cat = Object.fromEntries(cats.map((c) => [c.name, c.id]));
    logger.info('Categories ✓');

    // ── Users ────────────────────────────────────────────────────────────────
    const [adminHash, staffHash] = await Promise.all([
      bcrypt.hash('Admin@1234', 10),
      bcrypt.hash('Staff@1234', 10),
    ]);
    await client.query(
      `INSERT INTO users (name, email, password, role) VALUES
         ('Admin User', 'admin@warehouse.com', $1, 'admin'),
         ('Staff User', 'staff@warehouse.com', $2, 'staff')`,
      [adminHash, staffHash]
    );
    logger.info('Users ✓');

    // ── Products ─────────────────────────────────────────────────────────────
    const { rows: products } = await client.query(
      `INSERT INTO products (name, description, category_id, price) VALUES
         ('Full Fat Milk 1L',  'Fresh whole milk',   $1, 2.99),
         ('White Bread Loaf',  'Soft sliced loaf',   $2, 1.79),
         ('Bananas',           'Fresh ripe bananas', $3, 0.69),
         ('Orange Juice 1L',   'No added sugar',     $4, 3.49)
       RETURNING id`,
      [cat['Dairy'], cat['Bakery'], cat['Produce'], cat['Beverages']]
    );
    logger.info('Products ✓');

    // ── Inventory ────────────────────────────────────────────────────────────
    const { rows: inv } = await client.query(
      `INSERT INTO inventory (product_id, quantity, expiry_date, threshold) VALUES
         ($1, 42, $5,  10),
         ($2,  8, $6,  12),
         ($3, 24, $7,  15),
         ($4, 15, $8,   8)
       RETURNING id, product_id`,
      [
        products[0].id, products[1].id, products[2].id, products[3].id,
        addDays(12), addDays(5), addDays(4), addDays(28),
      ]
    );
    const invMap = Object.fromEntries(inv.map((r) => [r.product_id, r.id]));
    logger.info('Inventory ✓');

    // ── Alerts ───────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO alerts (inventory_id, type, message) VALUES
         ($1, 'low',    '"White Bread Loaf" is running low.'),
         ($2, 'expiry', '"Bananas" expire soon.')`,
      [invMap[products[1].id], invMap[products[2].id]]
    );
    logger.info('Alerts ✓');

    // ── Demo sale ────────────────────────────────────────────────────────────
    const { rows: [staff] } = await client.query(
      `SELECT id FROM users WHERE role = 'staff' LIMIT 1`
    );
    const { rows: [sale] } = await client.query(
      `INSERT INTO sales (user_id, total_amount, notes)
       VALUES ($1, 8.97, 'Demo sale') RETURNING id`,
      [staff.id]
    );
    await client.query(
      `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES
         ($1, $2, 2, 2.99),
         ($1, $3, 1, 2.99)`,
      [sale.id, products[0].id, products[1].id]
    );
    logger.info('Demo sale ✓');

    logger.info('');
    logger.info('Seed complete.');
    logger.info('  Admin: admin@warehouse.com / Admin@1234');
    logger.info('  Staff: staff@warehouse.com / Staff@1234');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exitCode = 1;
});
