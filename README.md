# WarehouseMS — Web-Based Warehouse & Sales Management System

A full-stack system for supermarket suppliers to manage inventory, process sales, and generate PDF business intelligence reports. Live on Vercel, backed by a Neon Postgres database.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, custom CSS, vanilla JS (SPA-style controller) |
| Backend | Node.js + Express.js |
| Database | PostgreSQL (Neon in production, local Postgres in dev) |
| Auth | JWT access + refresh tokens, optional Google sign-in |
| PDFs | PDFKit (invoices + sales reports) |
| Jobs | node-cron (daily expiry/low-stock scanner) |
| Logging | Winston |
| Hosting | Vercel (serverless) + Neon (Postgres) |

---

## Project Structure

```
warehouse-system/
├── api/
│   └── index.js              # Vercel serverless entry — re-exports backend/app
├── backend/
│   ├── config/
│   │   ├── db.js             # PostgreSQL connection pool
│   │   └── logger.js         # Winston logger
│   ├── db/
│   │   ├── schema.sql        # Tables, indexes, trigger for inventory.last_updated
│   │   ├── migrate.js        # `npm run migrate` — applies schema.sql (idempotent)
│   │   └── seed.js           # `npm run seed` — DESTRUCTIVE: truncates + seeds 303 products
│   ├── middleware/
│   │   ├── auth.js           # JWT sign / authenticate / authorize (RBAC)
│   │   ├── errorHandler.js   # Global error + 404 handlers
│   │   └── validate.js       # express-validator wrapper
│   ├── routes/
│   │   ├── auth.js           # Login, Google sign-in, refresh, /me
│   │   ├── products.js       # CRUD + paginated list
│   │   ├── inventory.js      # List, receive stock, manual adjust, override
│   │   ├── sales.js          # CRUD, invoice PDF, Smart Suggestions endpoint
│   │   ├── alerts.js         # List, mark read, mark all read
│   │   ├── admin.js          # Dashboard KPIs, user CRUD, sales report PDF
│   │   ├── categories.js     # List + create
│   │   └── activity.js       # Audit log feed
│   ├── services/
│   │   ├── activityLogger.js # Append-only audit log helper
│   │   ├── alertService.js   # Upsert low-stock / expiry alerts
│   │   ├── cronService.js    # Daily 06:00 expiry monitor
│   │   └── pdfService.js     # Invoice + sales report PDF generation
│   ├── app.js                # Express app config (importable, no listen())
│   ├── server.js             # Local dev entry — calls app.listen() + cron
│   └── package.json
│
├── frontend/
│   ├── assets/
│   │   ├── css/main.css      # Full design system
│   │   └── js/
│   │       ├── api.js        # Centralised authenticated fetch + token refresh
│   │       ├── ui.js         # Toast, modal, formatter helpers
│   │       ├── login.js      # Login page controller
│   │       └── dashboard.js  # SPA controller (state, routing, every page)
│   └── pages/
│       ├── login.html
│       └── dashboard.html
│
├── vercel.json               # Vercel routing — /api/* → api/index, static frontend
├── package.json              # Root package (used by Vercel build)
├── .gitignore
└── README.md
```

---

## Local Development

You need a PostgreSQL database. Two options:

### Option A — Use the same Neon database as production

```bash
cd backend
# Create backend/.env with your Neon connection string
echo "PORT=3000"                                           >  .env
echo "NODE_ENV=development"                                >> .env
echo "JWT_SECRET=replace-with-a-long-random-secret"        >> .env
echo "FRONTEND_URL=http://localhost:5500"                  >> .env
echo "DATABASE_URL=postgresql://..."                       >> .env

npm install
npm run dev
```

### Option B — Local Postgres

```bash
psql -U postgres -c "CREATE DATABASE warehouse_db;"

cd backend
# Point backend/.env at localhost:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/warehouse_db

npm install
npm run migrate              # creates tables, indexes, triggers (non-destructive)
npm run seed                 # WIPES + reseeds 303 demo products + 2 demo users
npm run dev
```

Open **http://localhost:3000**.

**Demo credentials** (after seeding):
- Admin: `admin@warehouse.com` / `Admin@1234`
- Staff: `staff@warehouse.com` / `Staff@1234`

---

## Production Deployment (Vercel + Neon)

The repo is wired up for Vercel:

- `vercel.json` rewrites `/api/*` to `api/index.js`, which re-exports the Express app as a serverless function.
- Set `DATABASE_URL` and `JWT_SECRET` in Vercel's project Environment Variables.
- Push to `main` → Vercel auto-deploys.

Schema lives in Neon; pushing code never touches data. To rebuild the DB from scratch in a new Neon project, run `npm run migrate` and `npm run seed` against that project's connection string.

---

## Environment Variables (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port (local dev only) |
| `NODE_ENV` | `development` | `development` / `production` |
| `JWT_SECRET` | *(required)* | Secret used to sign access tokens |
| `JWT_REFRESH_SECRET` | falls back to `JWT_SECRET` | Optional separate secret for refresh tokens |
| `DATABASE_URL` | *(required)* | PostgreSQL connection string |
| `FRONTEND_URL` | `http://localhost:5500` | Allowed CORS origin in dev |
| `GOOGLE_CLIENT_ID` | *(optional)* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | *(optional)* | Google OAuth client secret |

---

## API Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Email + password login |
| POST | `/api/auth/google` | Public | Google OAuth upsert + tokens |
| POST | `/api/auth/refresh` | Public | Exchange refresh token for new access token |
| GET | `/api/auth/me` | Auth | Current user profile |
| GET | `/api/health` | Public | Server health check |
| GET | `/api/products` | Auth | Paginated product list (with inventory + status) |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |
| GET | `/api/inventory` | Auth | Paginated inventory list |
| POST | `/api/inventory/:id/stock` | Auth | Receive a shipment (increment quantity) |
| POST | `/api/inventory/:id/adjust` | Admin | Manual relative correction with audit reason |
| PATCH | `/api/inventory/:id/quantity` | Admin | Set absolute quantity |
| GET | `/api/sales` | Auth | List sales (admin sees all, staff sees own) |
| GET | `/api/sales/:id` | Auth | Single sale with line items |
| POST | `/api/sales` | Auth | Process a sale (atomic stock deduction) |
| GET | `/api/sales/:id/invoice` | Auth | Download PDF invoice |
| GET | `/api/sales/suggestions` | Auth | Smart Suggestions for cart products |
| GET | `/api/alerts` | Auth | List alerts (filter by `?type=low|expiry`) |
| PATCH | `/api/alerts/:id/read` | Auth | Mark single alert read |
| PATCH | `/api/alerts/read-all` | Auth | Mark every alert read |
| GET | `/api/admin/dashboard` | Auth | KPI stats + top movers + recent alerts |
| GET | `/api/admin/users` | Admin | List users |
| POST | `/api/admin/users` | Admin | Create user |
| DELETE | `/api/admin/users/:id` | Admin | Delete user (cannot self-delete) |
| GET | `/api/admin/reports/sales` | Admin | Stream PDF sales report |
| GET | `/api/categories` | Auth | List categories |
| POST | `/api/categories` | Admin | Create category |
| GET | `/api/activity` | Auth | Audit log (admin: all users; staff: own only) |
| GET | `/api/activity/users` | Admin | User dropdown for audit-log filter |

---

## Key Design Decisions

- **Atomic sales transactions** — stock deduction, sale_items insertion, and low-stock alert creation happen in a single Postgres transaction with `SELECT … FOR UPDATE` row-level locking to prevent overselling under concurrency.
- **Role separation** — `authenticate` middleware verifies the JWT and populates `req.user`; `authorize('admin')` gates admin endpoints on top of that.
- **Alert deduplication** — `ensureAlert()` upserts on (`inventory_id`, `type`, `is_read=false`) to prevent the cron job from spamming duplicate alerts.
- **Daily expiry monitor** — `cronService.js` runs at 06:00 every day and once at boot, scanning for stock expiring within 30 days and items at/below their threshold.
- **Smart Suggestions (AI)** — `/api/sales/suggestions` combines two layers: a SQL self-join over `sale_items` mining real co-purchase patterns, and a curated Lebanese-cuisine pairing engine (~30 rules) that fills in when sales history is sparse.
- **Token refresh** — frontend `api.js` silently exchanges refresh tokens on 401, retrying the original request once before bouncing the user back to login.
- **Pagination caps** — `/products` and `/inventory` accept up to 1000 rows per page so client-side category/search filters always have the full set.
- **Rate limiting** — 100 req/15 min globally, 20 req/15 min on auth endpoints (skipped outside `NODE_ENV=production`).
