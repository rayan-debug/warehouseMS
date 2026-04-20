const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken, authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = rows[0];

    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    return res.json({
      success: true,
      token: signToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/google', async (req, res, next) => {
  try {
    const { email, name, googleId } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const { rows } = await db.query(
      `INSERT INTO users (name, email, role, google_id)
       VALUES ($1, $2, 'staff', $3)
       ON CONFLICT (email) DO UPDATE
         SET google_id = COALESCE(EXCLUDED.google_id, users.google_id),
             name      = COALESCE(EXCLUDED.name, users.name)
       RETURNING id, name, email, role`,
      [name || email.split('@')[0], email.toLowerCase(), googleId || null]
    );

    const user = rows[0];
    return res.json({
      success: true,
      token: signToken(user),
      user,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
