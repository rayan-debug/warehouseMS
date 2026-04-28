const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { generateSalesReportPdf } = require('../services/pdfService');
const { logActivity } = require('../services/activityLogger');

// Admin API: dashboard stats, user CRUD, and the sales report PDF.
// All endpoints below the dashboard require role=admin (see router.use guard).
const router = express.Router();

// Compute headline KPI numbers in parallel: total products, low-stock count,
// today's revenue, and revenue for the current calendar month.
async function getStats() {
  const [
    { rows: [{ count: totalProducts }] },
    { rows: [{ count: lowStock }] },
    { rows: [{ total: todayRevenue }] },
    { rows: [{ total: monthRevenue }] },
  ] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM products'),
    db.query('SELECT COUNT(*)::int AS count FROM inventory WHERE quantity <= threshold'),
    db.query(`SELECT COALESCE(SUM(total_amount), 0)::float AS total
              FROM sales WHERE created_at::date = CURRENT_DATE`),
    db.query(`SELECT COALESCE(SUM(total_amount), 0)::float AS total
              FROM sales WHERE date_trunc('month', created_at) = date_trunc('month', NOW())`),
  ]);
  return { totalProducts, lowStock, todayRevenue, monthRevenue };
}

// GET /api/admin/dashboard — KPIs + top 5 movers + 5 latest alerts.
// Available to any authenticated user (gated above the admin-only middleware).
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const [stats, { rows: topMovingProducts }, { rows: recentAlerts }] = await Promise.all([
      getStats(),
      db.query(`
        SELECT p.name, COALESCE(SUM(si.quantity), 0)::int AS total_sold
        FROM products p
        LEFT JOIN sale_items si ON si.product_id = p.id
        GROUP BY p.id, p.name
        ORDER BY total_sold DESC
        LIMIT 5
      `),
      db.query(`
        SELECT a.id, a.type, a.message, a.is_read, a.created_at,
               p.name AS inventory_name
        FROM alerts a
        JOIN inventory i ON i.id = a.inventory_id
        JOIN products  p ON p.id = i.product_id
        ORDER BY a.created_at DESC
        LIMIT 5
      `),
    ]);
    return res.json({ success: true, stats: { ...stats, topMovingProducts, recentAlerts } });
  } catch (err) {
    return next(err);
  }
});

// All routes below this guard require an authenticated admin.
router.use(authenticate, authorize('admin'));

// GET /api/admin/users — list every user (no passwords, ordered by id).
router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, role, google_id, created_at FROM users ORDER BY id'
    );
    return res.json({ success: true, users: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/users — create a user with a bcrypt-hashed password.
// 23505 = unique constraint violation, mapped to 409 Conflict.
router.post('/users', [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
  body('role').optional().isIn(['admin', 'staff']).withMessage('Role must be "admin" or "staff".'),
], validate, async (req, res, next) => {
  const { name, email, password, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, hash, role || 'staff']
    );
    logActivity(req.user.id, 'Created user', `${rows[0].email} (${rows[0].role})`);
    return res.status(201).json({ success: true, user: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }
    return next(err);
  }
});

// DELETE /api/admin/users/:id — admins cannot delete themselves; returns 400 if attempted.
router.delete('/users/:id', async (req, res, next) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  }
  try {
    const { rows: [target] } = await db.query('SELECT email, role FROM users WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'User not found.' });
    logActivity(req.user.id, 'Deleted user', `${target?.email} (${target?.role})`);
    return res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/reports/sales — stream a generated sales summary PDF.
router.get('/reports/sales', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const [stats, { rows: sales }, { rows: products }] = await Promise.all([
      getStats(),
      db.query(`
        SELECT s.id, s.total_amount, s.created_at, u.name AS user_name
        FROM sales s JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC LIMIT 10
      `),
      db.query(`
        SELECT p.name, COALESCE(SUM(si.quantity), 0)::int AS quantity
        FROM products p
        LEFT JOIN sale_items si ON si.product_id = p.id
        GROUP BY p.id, p.name
        ORDER BY quantity DESC LIMIT 5
      `),
    ]);
    return generateSalesReportPdf(res, { stats, sales, products });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
