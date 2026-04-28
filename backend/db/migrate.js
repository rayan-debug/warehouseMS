// Migration runner — applies backend/db/schema.sql to the configured database.
// Schema uses CREATE TABLE IF NOT EXISTS, so re-running is non-destructive.
// Invoke via `npm run migrate`.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const logger = require('../config/logger');

// Connect to DATABASE_URL, execute schema.sql in one round-trip, then disconnect.
async function main() {
  if (!process.env.DATABASE_URL) {
    logger.info('DATABASE_URL not set. Skipping PostgreSQL migration and using demo data.');
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  await client.connect();
  try {
    await client.query(schema);
    logger.info('Database schema applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  logger.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
