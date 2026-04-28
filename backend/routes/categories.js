const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// Categories API: list all and (admin) create a new category.
const router = express.Router();

// GET /api/categories — flat list ordered by id.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM categories ORDER BY id');
    return res.json({ success: true, categories: rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/categories (admin) — create category. 23505 → 409 if name already exists.
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  if (!req.body?.name) {
    return res.status(400).json({ success: false, message: 'Category name is required.' });
  }
  try {
    const { rows } = await db.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [req.body.name]
    );
    return res.status(201).json({ success: true, category: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Category already exists.' });
    }
    return next(err);
  }
});

module.exports = router;
