const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const ALERT_SQL = `
  SELECT a.id, a.inventory_id, a.type, a.message, a.is_read, a.created_at,
         p.name AS inventory_name
  FROM alerts a
  JOIN inventory i ON i.id = a.inventory_id
  JOIN products  p ON p.id = i.product_id
`;

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type } = req.query;
    const { rows } = type
      ? await db.query(`${ALERT_SQL} WHERE a.type = $1 ORDER BY a.created_at DESC`, [type])
      : await db.query(`${ALERT_SQL} ORDER BY a.created_at DESC`);
    return res.json({ success: true, alerts: rows });
  } catch (err) {
    return next(err);
  }
});

router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await db.query('UPDATE alerts SET is_read = true');
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE alerts SET is_read = true WHERE id = $1
       RETURNING id, inventory_id, type, message, is_read, created_at`,
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }
    return res.json({ success: true, alert: rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
