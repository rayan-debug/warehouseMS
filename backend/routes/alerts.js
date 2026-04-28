const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

// Alerts API: list low-stock and expiry alerts; mark single or all as read.
const router = express.Router();

// Shared SELECT — alerts joined with inventory + product to expose product name.
const ALERT_SQL = `
  SELECT a.id, a.inventory_id, a.type, a.message, a.is_read, a.created_at,
         p.name AS inventory_name
  FROM alerts a
  JOIN inventory i ON i.id = a.inventory_id
  JOIN products  p ON p.id = i.product_id
`;

// Parse ?page=&limit= from the request, capped at 200 rows per page.
function parsePage(q) {
  const page  = Math.max(1, parseInt(q.page,  10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

// GET /api/alerts — paginated list, newest first; optional ?type=low|expiry filter.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type } = req.query;
    const { page, limit, offset } = parsePage(req.query);

    const [{ rows }, { rows: [{ count }] }] = await Promise.all([
      type
        ? db.query(`${ALERT_SQL} WHERE a.type = $1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`, [type, limit, offset])
        : db.query(`${ALERT_SQL} ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      type
        ? db.query('SELECT COUNT(*)::int AS count FROM alerts WHERE type = $1', [type])
        : db.query('SELECT COUNT(*)::int AS count FROM alerts'),
    ]);

    return res.json({
      success: true,
      alerts: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/alerts/read-all — mark every alert as read in one shot.
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await db.query('UPDATE alerts SET is_read = true');
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/alerts/:id/read — mark a single alert as read.
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE alerts SET is_read = true WHERE id = $1
       RETURNING id, inventory_id, type, message, is_read, created_at`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Alert not found.' });
    return res.json({ success: true, alert: rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
