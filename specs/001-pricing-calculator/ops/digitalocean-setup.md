# Deploy PostgreSQL on a DigitalOcean Droplet (Ubuntu 24.04) and connect the app

This guide covers setting up a self-hosted PostgreSQL instance on your own DigitalOcean Droplet (Ubuntu 24.04), securing network access, optional TLS or SSH tunneling, and wiring the backend to verify end-to-end health.

Audience: Developers and ops engineers deploying the backend API to use a database they manage directly on a droplet.

## Prerequisites

- Ubuntu 24.04 droplet with a sudo-capable user
- SSH access to the droplet from your workstation or CI runner
- Basic firewalling with UFW (recommended)
- Node.js on your developer machine (or on the droplet if you will run the API there)
- This repository cloned locally

## 1) Install PostgreSQL (latest stable)

Option A (Ubuntu repo version):

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

Option B (official PostgreSQL APT for latest version):

```bash
# Add PGDG repo for Ubuntu 24.04 (noble)
sudo apt-get install -y wget ca-certificates lsb-release gnupg
wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
  sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update
sudo apt install -y postgresql
```

Enable and start the service:

```bash
sudo systemctl enable --now postgresql
sudo systemctl status postgresql --no-pager
```

## 2) Create database and user

Switch to the postgres user and create a dedicated role and database:

```bash
sudo -u postgres psql
```

In psql:

```sql
CREATE ROLE app_user WITH LOGIN PASSWORD 'replace-with-strong-password';
CREATE DATABASE pricing_calculator OWNER app_user;
GRANT ALL PRIVILEGES ON DATABASE pricing_calculator TO app_user;
\q
```

## 3) Choose your connectivity pattern

Pick one of the following setups.

- Same droplet (recommended for simplest secure setup):
  - Run the backend API on the same droplet as PostgreSQL.
  - Keep PostgreSQL bound to localhost only (default). No firewall changes needed.
  - DATABASE_URL will use host=localhost.

- Over SSH tunnel (recommended if developing from your laptop):
  - Do not expose port 5432 publicly.
  - Create an SSH local tunnel from your laptop to the droplet:

    ```bash
    ssh -N -L 5432:127.0.0.1:5432 <username>@<your-droplet-ip>
    ```

  - DATABASE_URL on your laptop points to host=127.0.0.1 port=5432.

- Public network access (only if necessary):
  - Configure PostgreSQL to listen on the droplet’s network interface.
  - Restrict access by IP using both UFW and pg_hba.conf.
  - Strongly consider TLS before exposing 5432.

## 4) PostgreSQL network configuration

Edit postgresql.conf (version-specific path, e.g., /etc/postgresql/<version>/main/postgresql.conf):

- Same droplet or SSH tunnel: keep the default

```conf
listen_addresses = 'localhost'
```

- Public access (use your droplet’s IP or all interfaces):

```conf
listen_addresses = '*'
```

Update pg_hba.conf (e.g., /etc/postgresql/<version>/main/pg_hba.conf):

- Allow local connections for the app user:

```conf
# TYPE  DATABASE              USER      ADDRESS        METHOD
local   pricing_calculator    app_user                 scram-sha-256
```

- If you must allow a specific external IP (replace 203.0.113.10/32):

```conf
host    pricing_calculator    app_user  203.0.113.10/32  scram-sha-256
```

Apply changes:

```bash
sudo systemctl restart postgresql
```

Configure UFW if exposing 5432 publicly (limit to your IP):

```bash
sudo ufw allow from 203.0.113.10 to any port 5432 proto tcp
sudo ufw status
```

## 5) TLS options (choose one)

- Option A: SSH tunnel (no direct TLS config needed on PostgreSQL). This keeps 5432 closed publicly and encrypts traffic via SSH.

- Option B: Server-side TLS for PostgreSQL. This is advanced and requires server certificates:
  - Generate or obtain a certificate and key (server.crt, server.key) on the droplet.
  - In postgresql.conf set:

    ```conf
    ssl = on
    ssl_cert_file = '/etc/postgresql/server.crt'
    ssl_key_file  = '/etc/postgresql/server.key'
    ```

  - For strict certificate validation by the client, you need a CA that signed your server cert and the client must trust it.
  - Current backend code supports:
    - sslmode=require (via DATABASE_URL query param)
    - Optional CA content via environment variable DATABASE_CA_CERT (PEM content). If not provided and sslmode=require or production env, the pool will set rejectUnauthorized=false (not recommended for production on public networks).

Recommendation: Prefer SSH tunnels or same-host deployment unless you’re comfortable managing TLS and CA distribution.

## 6) Backend configuration

Create backend/.env with one of the following:

- Same droplet (API talks to local PostgreSQL):

```env
NODE_ENV=production
PORT=4000
LOG_LEVEL=info
DATABASE_URL=postgres://app_user:your-password@localhost:5432/pricing_calculator
ALLOWED_ORIGINS=http://localhost:5173
```

- Laptop → droplet via SSH tunnel:

```env
NODE_ENV=development
PORT=4000
LOG_LEVEL=info
DATABASE_URL=postgres://app_user:your-password@127.0.0.1:5432/pricing_calculator
ALLOWED_ORIGINS=http://localhost:5173
```

- Public network with TLS (advanced):

```env
NODE_ENV=production
PORT=4000
LOG_LEVEL=info
DATABASE_URL=postgres://app_user:your-password@db.example.com:5432/pricing_calculator?sslmode=require
# Optional strict verification (PEM contents). If omitted, client may not verify the server cert.
# DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"
ALLOWED_ORIGINS=http://your-frontend-domain
```

Note: If you place certificate files on disk instead, the current pool implementation does not read a CA path automatically. Use SSH tunnel or set DATABASE_CA_CERT with the PEM contents if you require CA verification.

## 7) Install dependencies and run migrations

From repo root:

```bash
cd backend
npm install
npm run build
# Check available migration scripts in package.json; typical commands:
# npm run migrate:up
# npm run migrate:status
```

The repository includes:
- SQL migrations in backend/src/db/migrations/
- Migration runner at backend/src/db/migrationRunner.ts and backend/src/db/migrate.ts

## 8) Run the backend and verify health

Start the API:

```bash
cd backend
npm run dev
```

Probe the health endpoint:

```bash
curl -sS http://localhost:4000/api/v1/health | jq .
```

Expected: HTTP 200 with service and database status fields. If DB is unreachable, logs will show the reason and the endpoint will report failure.

## 9) Troubleshooting

- Connection refused/timeouts: verify PostgreSQL is running, correct host/port, UFW rules, and pg_hba.conf entries.
- Authentication failed: re-check role password and ensure pg_hba.conf uses scram-sha-256 for your user.
- SSL/TLS errors: prefer SSH tunnel for development; for TLS, ensure sslmode=require and provide a trusted CA via DATABASE_CA_CERT if strict verification is desired.
- Migrations failing: confirm user privileges and DATABASE_URL points to pricing_calculator.

## 10) Verification checklist

- You can connect with psql from your workstation (via SSH tunnel or public IP if allowed):

```bash
psql "postgres://app_user:your-password@127.0.0.1:5432/pricing_calculator"
```

- Backend health endpoint returns 200 and shows database healthy.
- Application logs at startup show a successful DB connectivity check.
