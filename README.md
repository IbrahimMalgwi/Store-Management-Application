# Store Management Application

Store Management Application is a React, Express, and SQLite inventory, sales, receipt, and reporting system. It can run as a local Node application or as a standalone Docker installation.

## Requirements

For a local installation:

- Node.js 24 or newer
- npm

For a Docker installation:

- Docker Engine with Docker Compose

## Local Development

1. Install dependencies:

```bash
npm run install:all
```

2. Create the backend environment file:

```powershell
Copy-Item backend\.env.example backend\.env
```

3. Optional: create a frontend environment file when the API is hosted separately:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

4. Start the frontend and backend development servers:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173`. The API runs at `http://localhost:5000`.

## Local Production Run

Build the frontend and validate the backend:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The Express server hosts both the compiled UI and API at `http://localhost:5000`.

To build and start in one command:

```bash
npm run start:prod
```

## Standalone Docker Installation

1. Create the Docker environment file:

```powershell
Copy-Item .env.example .env
```

2. Replace `JWT_SECRET` in `.env` with a long random value.

3. Build and start the standalone container:

```bash
docker compose up -d --build
```

4. Open `http://localhost:5000`.

The SQLite database is persisted in `backend/data`. Backup files are stored in `backups`. Both directories are mounted from the host so application data survives container replacement.

Useful Docker commands:

```bash
docker compose logs -f stockos
docker compose restart stockos
docker compose down
```

## Backup And Restore

Create a consistent SQLite backup while a local installation is running:

```bash
npm run backup
```

Restore a local backup after stopping the application:

```bash
npm run restore -- backups/stockos-backup-YYYY-MM-DDTHH-MM-SS.sqlite --force
```

For Docker, create a backup inside the running container:

```bash
docker compose exec stockos node /app/scripts/backup.js
```

Restore a Docker backup:

```bash
docker compose stop stockos
docker compose run --rm stockos node /app/scripts/restore.js /app/backups/stockos-backup-YYYY-MM-DDTHH-MM-SS.sqlite --force
docker compose up -d
```

Restore validates the backup before replacing the database and saves the previous database in `backups` as a `pre-restore` file.

## Environment Configuration

Local backend settings live in `backend/.env`. Docker Compose settings live in `.env`.

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Backend listening port | `5000` |
| `STOCKOS_PORT` | Host port used by Docker Compose | `5000` |
| `JWT_SECRET` | Secret used to sign authentication tokens | Must be changed |
| `DATABASE_FILE` | SQLite database location relative to `backend` | `./data/store.sqlite` |
| `ACCESS_TOKEN_EXPIRES_IN` | Access-token lifetime | `15m` |
| `REFRESH_TOKEN_DAYS` | Refresh-token lifetime in days | `7` |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins | Local frontend URL |
| `BACKUP_DIR` | Local backup output directory relative to project root | `backups` |

## Sample Inventory Imports

Sample import files are committed for testing the item upload flow:

- `sample-item-upload.xlsx`
- `samples/items-import.csv`

The CSV example includes SKU, quantity, selling price, purchase cost, reorder threshold, category, supplier, and description fields.

## Default Demo Login

- Admin: `admin@store.com` / `admin123`
- Cashier: `jane@store.com` / `user123`

Change the default passwords before using the application with real business data.

## Verification

Run frontend linting, backend validation, and a production frontend build:

```bash
npm run verify
```

## Local Files

These files contain local data or secrets and are intentionally ignored by Git:

- `.env`
- `backend/.env`
- `backend/data/store.sqlite`
- `backend/data/store.sqlite-wal`
- `backend/data/store.sqlite-shm`
- `backups/`

The committed `.env.example` files are safe configuration templates.
