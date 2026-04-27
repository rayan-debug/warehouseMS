const express = require('express');
const { param } = require('express-validator');
const { pool, query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { generateInvoicePdf } = require('../services/pdfService');
const { ensureAlert } = require('../services/alertService');
const { logActivity } = require('../services/activityLogger');

const router = express.Router();

const clientError = (msg) => Object.assign(new Error(msg), { statusCode: 400 });

function parsePage(q) {
  const page  = Math.max(1, parseInt(q.page,  10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

// Smart Suggestions feature — postponed.
// GET /api/sales/suggestions?product_ids=1,2,3
// Returns products most frequently bought alongside the given cart products.
// router.get('/suggestions', authenticate, async (req, res, next) => {
//   try {
//     const ids = String(req.query.product_ids || '')
//       .split(',')
//       .map(Number)
//       .filter(Boolean);
//
//     if (!ids.length) return res.json({ success: true, suggestions: [] });
//
//     const { rows } = await query(`
//       SELECT
//         p.id,
//         p.name,
//         p.price,
//         i.quantity          AS available,
//         c.name              AS category_name,
//         COUNT(DISTINCT si2.sale_id)::int AS score
//       FROM sale_items si1
//       JOIN sale_items si2
//         ON  si2.sale_id    = si1.sale_id
//         AND si2.product_id <> si1.product_id
//       JOIN products   p ON p.id = si2.product_id
//       JOIN inventory  i ON i.product_id = p.id
//       LEFT JOIN categories c ON c.id = p.category_id
//       WHERE si1.product_id = ANY($1)
//         AND si2.product_id <> ALL($1)
//         AND i.quantity > 0
//       GROUP BY p.id, p.name, p.price, i.quantity, c.name
//       ORDER BY score DESC
//       LIMIT 5
//     `, [ids]);
//
//     return res.json({ success: true, suggestions: rows });
//   } catch (err) {
//     return next(err);
//   }
// });

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePage(req.query);
    const isAdmin = req.user.role === 'admin';
    const userFilter = isAdmin ? '' : 'WHERE s.user_id = $3';
    const countFilter = isAdmin ? '' : 'WHERE user_id = $1';
    const baseParams = [limit, offset];
    if (!isAdmin) baseParams.push(req.user.id);

    const [{ rows }, { rows: [{ count }] }] = await Promise.all([
      query(`
        SELECT s.id, s.user_id, u.name AS user_name,
               s.total_amount, s.notes, s.created_at,
               COUNT(si.id)::int AS items
        FROM sales s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN sale_items si ON si.sale_id = s.id
        ${userFilter}
        GROUP BY s.id, u.name
        ORDER BY s.created_at DESC
        LIMIT $1 OFFSET $2
      `, baseParams),
      query(`SELECT COUNT(*)::int AS count FROM sales ${countFilter}`,
        isAdmin ? [] : [req.user.id]),
    ]);
    return res.json({
      success: true,
      sales: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', authenticate, [
  param('id').isInt({ gt: 0 }).withMessage('Sale ID must be a positive integer.'),
], validate, async (req, res, next) => {
  try {
    const { rows: [sale] } = await query(
      `SELECT s.*, u.name AS user_name FROM sales s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [req.params.id]
    );
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    const { rows: items } = await query(
      `SELECT si.*, p.name AS product_name
       FROM sale_items si JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1`,
      [req.params.id]
    );
    return res.json({ success: true, sale: { ...sale, items } });
  } catch (err) {
    return next(err);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  const items = req.body.items || [];
  if (!items.length) {
    return res.status(400).json({ success: false, message: 'Sale must contain at least one item.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    const validated = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.product_id || !Number.isInteger(qty) || qty <= 0) {
        throw clientError('Invalid item: product_id and quantity > 0 are required.');
      }

      const { rows } = await client.query(
        `SELECT i.id AS inv_id, i.quantity AS available, i.threshold,
                p.name, p.id AS product_id, p.price
         FROM inventory i
         JOIN products p ON p.id = i.product_id
         WHERE p.id = $1
         FOR UPDATE`,
        [item.product_id]
      );
      const inv = rows[0];
      if (!inv) throw clientError(`Product ${item.product_id} not found in inventory.`);
      if (inv.available < qty) throw clientError(`Insufficient stock for "${inv.name}" (${inv.available} available).`);

      const price = Number(inv.price);
      totalAmount += qty * price;
      validated.push({ ...inv, qty, price });
    }

    const { rows: [sale] } = await client.query(
      `INSERT INTO sales (user_id, total_amount, notes)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, totalAmount.toFixed(2), req.body.notes || null]
    );

    for (const item of validated) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale)
         VALUES ($1, $2, $3, $4)`,
        [sale.id, item.product_id, item.qty, item.price]
      );
      await client.query(
        `UPDATE inventory SET quantity = quantity - $1, last_updated = NOW() WHERE id = $2`,
        [item.qty, item.inv_id]
      );
      if (item.available - item.qty <= item.threshold) {
        await ensureAlert(client.query.bind(client), item.inv_id, 'low', `"${item.name}" is running low.`);
      }
    }

    await client.query('COMMIT');

    const { rows: [detail] } = await query(
      `SELECT s.*, u.name AS user_name FROM sales s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [sale.id]
    );
    const { rows: saleItems } = await query(
      `SELECT si.*, p.name AS product_name
       FROM sale_items si JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1`,
      [sale.id]
    );

    logActivity(req.user.id, 'Processed sale', `Sale #${sale.id} — ${validated.length} item(s), total $${totalAmount.toFixed(2)}`);
    return res.status(201).json({ success: true, sale: { ...detail, items: saleItems } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  } finally {
    client.release();
  }
});

router.get('/:id/invoice', authenticate, [
  param('id').isInt({ gt: 0 }).withMessage('Sale ID must be a positive integer.'),
], validate, async (req, res, next) => {
  try {
    const { rows: [sale] } = await query(
      `SELECT s.*, u.name AS user_name FROM sales s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [req.params.id]
    );
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    const { rows: saleItems } = await query(
      `SELECT si.*, p.name AS product_name
       FROM sale_items si JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1`,
      [req.params.id]
    );
    return generateInvoicePdf(res, { ...sale, items: saleItems });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
