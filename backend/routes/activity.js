const express = require('express');
const { query: dbQuery } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function parsePage(q) {
  const page  = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

// GET /api/activity
// Admin sees all users; staff sees only their own.
// Optional ?user_id= filter (admin only).
router.get('/', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { page, limit, offset } = parsePage(req.query);

    const filterUserId = isAdmin && req.query.user_id
      ? parseInt(req.query.user_id, 10) || null
      : null;

    const targetUserId = isAdmin ? filterUserId : req.user.id;

    const whereParts = [];
    const params     = [];

    if (targetUserId) {
      params.push(targetUserId);
      whereParts.push(`al.user_id = $${params.length}`);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    const [{ rows }, { rows: [{ count }] }] = await Promise.all([
      dbQuery(`
        SELECT al.id, al.action, al.details, al.ip_address, al.created_at,
               u.id AS user_id, u.name AS user_name, u.role AS user_role
        FROM activity_logs al
        JOIN users u ON u.id = al.user_id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      dbQuery(`
        SELECT COUNT(*)::int AS count
        FROM activity_logs al
        ${whereClause}
      `, params.slice(0, -2)),
    ]);

    return res.json({
      success: true,
      logs: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/activity/users  — list of users for the admin filter dropdown
router.get('/users', authenticate, async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  try {
    const { rows } = await dbQuery('SELECT id, name, role FROM users ORDER BY name');
    return res.json({ success: true, users: rows });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
