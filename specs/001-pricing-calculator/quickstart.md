# Quickstart: Pricing Calculator

This guide helps you run the Pricing Calculator (backend API + frontend app) locally.

## Prerequisites

- Node.js 24.11.0 LTS (installation verified by `node -v`)
- pnpm or npm (choose one; examples assume npm)
- PostgreSQL 18 (DigitalOcean managed or local)
- Git

## Configuration

Create a `.env` in `backend/` with:

```
DATABASE_URL=postgres://<user>:<pass>@<host>:<port>/<db>
NODE_ENV=development
PORT=4000
LOG_LEVEL=info
ALLOWED_ORIGINS=http://localhost:5173
QUOTE_DOC_BRAND_LOGO_URL=<https-url-or-path>
```

Create a `.env` in `frontend/` with:

```
VITE_API_BASE=http://localhost:4000/api/v1
```

## Install & Run

Backend:

```
cd backend
npm install
npm run dev
```

Frontend:

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Testing

Backend tests (unit + contract):

```
cd backend
npm test
```

Frontend tests:

```
cd frontend
npm test
```

## Notes

- Use the Configuration Panel to set a current pricing configuration before calculating.
- Quote numbers are assigned on save; calculation-only does not persist.
- Document generation returns a PDF stream for download.
