// Local-dev entry point. Vercel uses api/index.js instead and handles its own
// listener — this file only runs under `npm run dev` / `npm start`.
const app = require('./app');
const logger = require('./config/logger');
const { testConnection } = require('./config/db');
const { startExpiryMonitor } = require('./services/cronService');

const PORT = process.env.PORT || 3000;

// Boot the HTTP server, smoke-test the DB connection, and start the cron monitor.
app.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  try {
    await testConnection();
    logger.info('PostgreSQL connected successfully.');
  } catch (err) {
    logger.error(`PostgreSQL connection failed: ${err.message}`);
    logger.error('Check DATABASE_URL in backend/.env — is Docker running?');
  }
  startExpiryMonitor();
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});
