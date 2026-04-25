const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/db');
const { signToken, signRefreshToken, refreshSecret, authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logActivity } = require('../services/activityLogger');

const router = express.Router();

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
], validate, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    logActivity(user.id, 'Logged in', null, ip);
    return res.json({
      success: true,
      token: signToken(user),
      refreshToken: signRefreshToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/google', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('googleId').notEmpty().withMessage('Google ID is required.'),
], validate, async (req, res, next) => {
  try {
    const { email, name, googleId } = req.body;

    const { rows } = await db.query(
      `INSERT INTO users (name, email, role, google_id)
       VALUES ($1, $2, 'staff', $3)
       ON CONFLICT (email) DO UPDATE
         SET google_id = COALESCE(EXCLUDED.google_id, users.google_id),
             name      = COALESCE(EXCLUDED.name, users.name)
       RETURNING id, name, email, role`,
      [name || email.split('@')[0], email, googleId]
    );

    const user = rows[0];
    return res.json({
      success: true,
      token: signToken(user),
      refreshToken: signRefreshToken(user),
      user,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Refresh token required.' });
  }
  try {
    const payload = jwt.verify(refreshToken, refreshSecret());
    if (payload.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }
    const { rows } = await db.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [payload.id]
    );
    if (!rows[0]) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, token: signToken(rows[0]) });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
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
