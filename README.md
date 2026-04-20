# WarehouseMS — Web-Based Warehouse & Sales Management System

A full-stack system for supermarket suppliers to manage inventory, process sales, and generate PDF business intelligence reports.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Tailwind-inspired custom CSS, Vanilla JS (AJAX) |
| Backend | Node.js + Express.js |
| Database | PostgreSQL (optional — runs in-memory demo mode without it) |
| Auth | JWT + Google OAuth 2.0 |
| PDFs | PDFKit |
| Jobs | node-cron |
| Logging | Winston |
| Tests | Jest + Supertest |

---

## Project Structure

```
warehouse-system/
├── backend/
│   ├── config/
│   │   ├── db.js              # PostgreSQL connection pool (no-op without DATABASE_URL)
│   │   └── logger.js          # Winston logger
│   ├── controllers/           # Route handler stubs (wired to routes/)
│   ├── db/
│   │   ├── schema.sql         # Full PostgreSQL schema + indexes + triggers
│   │   ├── store.js           # In-memory data store (demo mode)
│   │   ├── migrate.js         # Migration runner
│   │   └── seed.js            # Dev seed data
│   ├── middleware/
│   │   ├── auth.js            # JWT sign / authenticate / authorize (RBAC)
│   │   ├── errorHandler.js    # Global error + 404 handlers
│   │   └── validate.js        # express-validator wrapper
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   ├── inventory.js
│   │   ├── sales.js
│   │   ├── alerts.js
│   │   ├── admin.js
│   │   └── categories.js
│   ├── services/
│   │   ├── pdfService.js      # Invoice + report PDF generation (PDFKit)
│   │   └── cronService.js     # Daily expiry alert scanner (node-cron)
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── auth.test.js         # signToken / authenticate / authorize
│   │   │   └── errorHandler.test.js # notFound / errorHandler
│   │   └── integration/
│   │       └── auth.routes.test.js  # POST /login, GET /me — hits real route handlers
│   ├── app.js             # Express app config (no listen — importable by tests)
│   ├── server.js          # Calls app.listen(), starts cron + DB
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── assets/
│   │   ├── css/main.css       # Full design system
│   │   └── js/
│   │       ├── api.js         # Centralised API client
│   │       ├── ui.js          # Toast, modal, format helpers
│   │       └── dashboard.js   # All page controllers
│   └── pages/
│       ├── login.html         # Login / Google OAuth page
│       └── dashboard.html     # Main SPA shell
│
├── docker-compose.yml     # Postgres 16 container (optional)
├── .gitignore
└── README.md
```

> **Auto-created at runtime** — `logs/` (Winston) and `generated/` (PDFKit) are created on first run and are in `.gitignore`.

---

## Quick Start (Demo Mode — no database required)

The server ships with an in-memory data store so you can run it instantly:

```bash
cd backend
cp .env.example .env   # defaults work as-is for demo mode
npm install
npm start
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

**Demo credentials:**
- Admin: `admin@warehouse.com` / `Admin@1234`
- Staff: `staff@warehouse.com` / `Staff@1234`

---

## Full Setup (PostgreSQL)

### Option A — Docker (recommended)

```bash
# Start Postgres — schema is applied automatically on first boot
docker-compose up -d

cd backend
cp .env.example .env   # DATABASE_URL is pre-configured for the container
npm install
npm run dev
```

### Option B — Local Postgres

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE warehouse_db;"

cd backend
cp .env.example .env          # set DATABASE_URL to your connection string
npm install
npm run migrate               # creates all tables, indexes, triggers
npm run seed                  # inserts demo data
npm run dev
```

### Environment variables (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `JWT_SECRET` | *(set this!)* | Secret used to sign JWTs |
| `DATABASE_URL` | *(empty)* | PostgreSQL connection string — omit to use demo mode |
| `FRONTEND_URL` | `http://localhost:5500` | Allowed CORS origin |
| `GOOGLE_CLIENT_ID` | *(optional)* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | *(optional)* | Google OAuth client secret |

---

## Running Tests

```bash
cd backend
npm test              # run all unit + integration tests once
npm run test:watch    # re-run on file change
```

Tests import `app.js` directly (no live server started) and use the in-memory store — no database needed.

---

## API Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Email + password login |
| POST | `/api/auth/google` | Public | Google OAuth login |
| GET | `/api/auth/me` | Auth | Get current user |
| GET | `/api/health` | Public | Server health check |
| GET | `/api/products` | Auth | List products with inventory |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |
| GET | `/api/inventory` | Auth | Full inventory list |
| POST | `/api/inventory/:id/stock` | Auth | Add stock |
| PATCH | `/api/inventory/:id/quantity` | Admin | Override quantity |
| GET | `/api/sales` | Auth | List sales |
| POST | `/api/sales` | Auth | Process a sale |
| GET | `/api/sales/:id/invoice` | Auth | Download PDF invoice |
| GET | `/api/alerts` | Auth | List alerts |
| PATCH | `/api/alerts/:id/read` | Auth | Mark alert read |
| GET | `/api/admin/dashboard` | Admin | KPI stats |
| GET | `/api/admin/users` | Admin | List users |
| POST | `/api/admin/users` | Admin | Create staff account |
| DELETE | `/api/admin/users/:id` | Admin | Delete user |
| GET | `/api/admin/reports/sales` | Admin | Stream PDF report |
| GET | `/api/categories` | Auth | List categories |
| POST | `/api/categories` | Admin | Create category |

---

## Key Design Decisions

- **Demo / production duality** — `store.js` is an in-memory replica of the schema so the full app runs without a database. `config/db.js` gracefully no-ops when `DATABASE_URL` is unset.
- **Testable app entry point** — `app.js` configures Express and exports the app; `server.js` calls `app.listen()`. Tests import `app.js` so no port is bound during test runs.
- **Atomic sales transactions** — stock deduction and alert creation happen in a single PostgreSQL transaction with row-level locking to prevent race conditions.
- **Role separation** — middleware checks JWT role claim; admin routes are completely inaccessible to staff.
- **Alert deduplication** — the system checks for existing unread alerts before inserting new ones to prevent spam.
- **Cron expiry monitor** — runs at 06:00 daily, scans for items expiring within 30 days.
- **Rate limiting** — 100 req/15 min globally, 10 req/15 min on auth endpoints (bypassed in `NODE_ENV=test`).
