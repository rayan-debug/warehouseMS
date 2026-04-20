const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

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

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(`${INVENTORY_SQL} ORDER BY i.id`);
    return res.json({ success: true, inventory: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/stock', authenticate, async (req, res, next) => {
  const qty = Number(req.body.quantity);
  if (!qty || qty <= 0) {
    return res.status(400).json({ success: false, message: 'A positive quantity is required.' });
  }
  try {
    const { rows } = await db.query(
      `UPDATE inventory
       SET quantity     = quantity + $1,
           expiry_date  = COALESCE($2, expiry_date),
           last_updated = NOW()
       WHERE id = $3
       RETURNING id`,
      [qty, req.body.expiry_date || null, req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }
    const { rows: updated } = await db.query(`${INVENTORY_SQL} WHERE i.id = $1`, [rows[0].id]);
    return res.json({ success: true, inventory: updated[0] });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id/quantity', authenticate, authorize('admin'), async (req, res, next) => {
  const qty = Number(req.body.quantity);
  if (req.body.quantity === undefined || isNaN(qty) || qty < 0) {
    return res.status(400).json({ success: false, message: 'A non-negative quantity is required.' });
  }
  try {
    const { rows } = await db.query(
      `UPDATE inventory
       SET quantity = $1, last_updated = NOW()
       WHERE id = $2
       RETURNING id`,
      [qty, req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Inventory item not found.' });
    }
    const { rows: updated } = await db.query(`${INVENTORY_SQL} WHERE i.id = $1`, [rows[0].id]);
    return res.json({ success: true, inventory: updated[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
