const express = require('express');
const { pool, query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const PRODUCT_SQL = `
  SELECT p.id, p.name, p.description, p.category_id, p.price, p.created_at,
         c.name AS category_name,
         COALESCE(i.quantity, 0)   AS quantity,
         COALESCE(i.threshold, 10) AS threshold,
         i.expiry_date,
         i.last_updated,
         CASE
           WHEN COALESCE(i.quantity, 0) <= 0                          THEN 'out'
           WHEN COALESCE(i.quantity, 0) <= COALESCE(i.threshold, 10) THEN 'low'
           ELSE 'ok'
         END AS status
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN inventory  i ON i.product_id = p.id
`;

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(`${PRODUCT_SQL} ORDER BY p.id`);
    return res.json({ success: true, products: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  const { name, description, category_id, price, quantity, threshold, expiry_date } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Product name is required.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [{ id: productId }] } = await client.query(
      `INSERT INTO products (name, description, category_id, price)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, description || null, category_id || null, Number(price ?? 0)]
    );
    await client.query(
      `INSERT INTO inventory (product_id, quantity, expiry_date, threshold)
       VALUES ($1, $2, $3, $4)`,
      [productId, Number(quantity ?? 0), expiry_date || null, Number(threshold ?? 10)]
    );
    await client.query('COMMIT');
    const { rows } = await query(`${PRODUCT_SQL} WHERE p.id = $1`, [productId]);
    return res.status(201).json({ success: true, product: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    return next(err);
  } finally {
    client.release();
  }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  const { name, description, category_id, price, quantity, threshold, expiry_date } = req.body;
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE products
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           category_id = COALESCE($3, category_id),
           price       = COALESCE($4, price)
       WHERE id = $5`,
      [name || null, description || null, category_id || null, price != null ? Number(price) : null, id]
    );
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    if (quantity != null || threshold != null || expiry_date !== undefined) {
      const setClauses = [];
      const params = [];
      if (quantity != null) { params.push(Number(quantity)); setClauses.push(`quantity = $${params.length}`); }
      if (threshold != null) { params.push(Number(threshold)); setClauses.push(`threshold = $${params.length}`); }
      if (expiry_date !== undefined) { params.push(expiry_date || null); setClauses.push(`expiry_date = $${params.length}`); }
      setClauses.push('last_updated = NOW()');
      params.push(id);
      await client.query(
        `UPDATE inventory SET ${setClauses.join(', ')} WHERE product_id = $${params.length}`,
        params
      );
    }
    await client.query('COMMIT');
    const { rows } = await query(`${PRODUCT_SQL} WHERE p.id = $1`, [id]);
    return res.json({ success: true, product: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    return next(err);
  } finally {
    client.release();
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM products WHERE id = $1', [req.params.id]);
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    return res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
