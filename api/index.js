// Vercel serverless entry point — re-exports the Express app so /api/* routes
// are handled by the same backend used in local dev (backend/server.js).
module.exports = require('../backend/app');
