# Store Management Application

Store Management Application is a React and Express inventory, sales, receipt, and reporting system.

## Requirements

- Node.js 24 or newer
- npm

## Setup

1. Install dependencies:

```bash
npm run install:all
```

2. Create backend environment config:

```bash
copy backend\.env.example backend\.env
```

3. Optional frontend environment config:

```bash
copy frontend\.env.example frontend\.env
```

4. Start backend and frontend together:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173`.
The backend runs at `http://localhost:5000`.

## Default Demo Login

- Admin: `admin@store.com` / `admin123`
- User: `jane@store.com` / `user123`

## Important Local Files

- `backend/.env` contains local secrets and must not be committed.
- `backend/data/store.sqlite` contains local runtime data and must not be committed.
- `backend/data/db.json` is only used as a legacy migration source if it exists.
- `sample-item-upload.xlsx` is a sample inventory upload file.

## Improvement Roadmap

We will handle improvements one by one in this order:

1. Project hygiene: `.gitignore`, env examples, and setup docs.
2. Safer configuration and secrets handling.
3. Replace JSON storage with a production-ready database.
4. Add true multi-instance or tenant isolation.
5. Add roles and permissions.
6. Improve authentication: password changes, resets, session expiry, refresh tokens.
7. Add audit logs.
8. Expand business features: categories, suppliers, costs, profit, reorder levels, customers, returns.
9. Improve reporting dashboards and exports.
10. Improve UX: loading states, toasts, confirmations, pagination, sorting, mobile sales flow.
11. Add deployment packaging: Docker, backup/restore, and production scripts.
