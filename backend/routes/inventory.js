const express = require('express');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ensureAlert } = require('../services/alertService');
const { logActivity } = require('../services/activityLogger');

// Inventory API: list stock, receive new shipments, manual corrections,
// and absolute quantity overrides.
const router = express.Router();

// Shared SELECT — inventory joined with its product + category, with derived status.
const INVENTORY_SQL = `
  SELECT i.id, i.product_id,
         p.name AS product_name,
         c.name AS category_name,
         i.quantity, i.threshold, i.expiry_date, i.last_updated,
         CASE
           WHEN i.quantity <= 0           THEN 'out'
           WHEN i.quantity <= i.threshold THEN 'low'
           ELSE 'ok'
         END AS status
  FROM inventory i
  JOIN  products   p ON p.id = i.product_id
  LEFT JOIN categories c ON c.id = p.category_id
`;

// Parse ?page=&limit= from the request, capped at 1000 rows per page.
function parsePage(q) {
  const page  = Math.max(1, parseInt(q.page,  10) || 1);
  const limit = Math.min(1000, Math.max(1, parseInt(q.limit, 10) || 1000));
  return { page, limit, offset: (page - 1) * limit };
}

// GET /api/inventory — paginated stock list for the inventory table.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePage(req.query);
    const [{ rows }, { rows: [{ count }] }] = await Promise.all([
      db.query(`${INVENTORY_SQL} ORDER BY i.id LIMIT $1 OFFSET $2`, [limit, offset]),
      db.query('SELECT COUNT(*)::int AS count FROM inventory'),
    ]);
    return res.json({
      success: true,
      inventory: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/inventory/:id/stock — receive a shipment: increment quantity and
// optionally bump the expiry date for the new batch.
router.post('/:id/stock', authenticate, [
  param('id').isInt({ gt: 0 }).withMessage('Inventory ID must be a positive integer.'),
  body('quantity').isInt({ gt: 0 }).withMessage('A positive quantity is required.'),
  body('expiry_date').optional({ nullable: true }).isISO8601().withMessage('expiry_date must be a valid date (YYYY-MM-DD).'),
], validate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE inventory
       SET quantity     = quantity + $1,
           expiry_date  = COALESCE($2, expiry_date),
           last_updated = NOW()
       WHERE id = $3
       RETURNING id`,
      [Number(req.body.quantity), req.body.expiry_date || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    const { rows: updated } = await db.query(`${INVENTORY_SQL} WHERE i.id = $1`, [rows[0].id]);
    logActivity(req.user.id, 'Added stock', `+${req.body.quantity} units to "${updated[0]?.product_name}"`);
    return res.json({ success: true, inventory: updated[0] });
  } catch (err) {
    return next(err);
  }
});

// POST /api/inventory/:id/adjust (admin) — relative correction with audit reason.
// Quantity is floored at 0; if it falls under threshold, a low-stock alert fires.
router.post('/:id/adjust', authenticate, authorize('admin'), [
  param('id').isInt({ gt: 0 }).withMessage('Inventory ID must be a positive integer.'),
  body('adjustment').isInt().custom((v) => v !== 0).withMessage('Adjustment must be a non-zero integer.'),
  body('reason').trim().notEmpty().withMessage('Reason is required for stock adjustments.'),
], validate, async (req, res, next) => {
  const adj = Number(req.body.adjustment);
  try {
    const { rows } = await db.query(
      `UPDATE inventory
       SET quantity     = GREATEST(0, quantity + $1),
           last_updated = NOW()
       WHERE id = $2
       RETURNING id, quantity, threshold`,
      [adj, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Inventory item not found.' });

    const inv = rows[0];
    if (inv.quantity <= inv.threshold) {
      const { rows: [prod] } = await db.query(
        'SELECT p.name FROM products p JOIN inventory i ON i.product_id = p.id WHERE i.id = $1',
        [inv.id]
      );
      if (prod) {
        await ensureAlert(db.query.bind(db), inv.id, 'low', `"${prod.name}" is running low.`);
      }
    }

    const { rows: updated } = await db.query(`${INVENTORY_SQL} WHERE i.id = $1`, [inv.id]);
    const sign = adj > 0 ? `+${adj}` : String(adj);
    logActivity(req.user.id, 'Stock correction', `${sign} units on "${updated[0]?.product_name}" — ${req.body.reason}`);
    return res.json({ success: true, inventory: updated[0] });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/inventory/:id/quantity (admin) — set absolute quantity (overwrite).
router.patch('/:id/quantity', authenticate, authorize('admin'), [
  param('id').isInt({ gt: 0 }).withMessage('Inventory ID must be a positive integer.'),
  body('quantity').isInt({ min: 0 }).withMessage('A non-negative quantity is required.'),
], validate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE inventory SET quantity = $1, last_updated = NOW() WHERE id = $2 RETURNING id`,
      [Number(req.body.quantity), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    const { rows: updated } = await db.query(`${INVENTORY_SQL} WHERE i.id = $1`, [rows[0].id]);
    return res.json({ success: true, inventory: updated[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
