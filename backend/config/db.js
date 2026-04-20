const { Pool } = require('pg');
const logger = require('./logger');

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  throw new Error(
    'DATABASE_URL is required. Copy backend/.env.example to backend/.env and set your connection string.'
  );
}

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

if (pool) {
  pool.on('error', (err) => logger.error(`PG pool error: ${err.message}`));
}

async function query(text, values = []) {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  return pool.query(text, values);
}

async function testConnection() {
  if (!pool) return false;
  await pool.query('SELECT 1');
  return true;
}

module.exports = { pool, query, testConnection };
