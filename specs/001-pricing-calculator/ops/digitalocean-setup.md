# Deploy PostgreSQL on a DigitalOcean Droplet (Ubuntu 24.04) and connect the app

This guide covers setting up a self-hosted PostgreSQL instance on your own DigitalOcean Droplet (Ubuntu 24.04), securing network access, optional TLS or SSH tunneling, and wiring the backend to verify end-to-end health.

Audience: Developers and ops engineers deploying the backend API to use a database they manage directly on a droplet.

## Prerequisites

- Ubuntu 24.04 droplet with a sudo-capable user (typically `root` initially)
- SSH access to the droplet from your workstation or CI runner
- UFW firewall enabled and configured (recommended)
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

Typical config paths on Ubuntu:

- `/etc/postgresql/<major>/main/postgresql.conf`
- `/etc/postgresql/<major>/main/pg_hba.conf`
- Service name: `postgresql`

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

- Same droplet (simplest and secure):
  - Run the backend API on the same droplet as PostgreSQL.
  - Keep PostgreSQL bound to localhost only (default).
  - No firewall changes needed.
  - `DATABASE_URL` uses `host=localhost`.
- Over SSH tunnel (recommended for local development from your laptop):
  - Do not expose port 5432 publicly.
  - Keep `listen_addresses = 'localhost'` on the droplet.
  - Create a local SSH tunnel from your laptop (see section 4A).
  - `DATABASE_URL` on your laptop uses `host=127.0.0.1 port=5432`.
- Private network (best for two droplets in same VPC/region):
  - Enable and use DigitalOcean VPC private IPs.
  - Set Postgres to listen on the private interface and restrict by the backend droplet’s private IP in `pg_hba.conf` and UFW.
  - No public exposure of 5432.
- Public network access (only if necessary):
  - Set Postgres to listen on the droplet’s public interface.
  - Restrict access by IP using both UFW and `pg_hba.conf`.
  - Strongly consider TLS before exposing 5432.

## 4) 4) PostgreSQL network configuration

Edit `postgresql.conf` (e.g., `/etc/postgresql/<major>/main/postgresql.conf`):

- Same droplet or SSH tunnel (keep default):

```conf
listen_addresses = 'localhost'
```

- Private network (VPC):
  - Replace with the droplet’s **private** IP or `*` and then restrict via `pg_hba.conf` and UFW:

```conf
listen_addresses = '*'
```

- Public access (if you must):

```conf
listen_addresses = '*'
```

Edit `pg_hba.conf` (e.g., `/etc/postgresql/<major>/main/pg_hba.conf`):

- Allow local connections for the app user:

```conf
# TYPE  DATABASE              USER      ADDRESS        METHOD
local   pricing_calculator    app_user                 scram-sha-256
```

- If you must allow a specific external IP (replace `203.0.113.10/32`):

```conf
host    pricing_calculator    app_user  203.0.113.10/32  scram-sha-256
```

Apply changes:

```bash
sudo systemctl restart postgresql
```

### UFW examples

- Default sane baseline:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw enable
```

- Allow 5432 only from a specific IP (public or private):

```bash
sudo ufw allow from 203.0.113.10 to any port 5432 proto tcp
sudo ufw status
```

- If you previously allowed 5432 broadly, revoke it:

```bash
sudo ufw deny 5432/tcp
```

## 4A) SSH tunnel (Windows/macOS/Linux)

Keep `listen_addresses = 'localhost'` on the droplet. The tunnel forwards your local `127.0.0.1:5432` to the droplet’s `127.0.0.1:5432`.

### Set up an SSH key (one-time)

If you don’t have a key on your laptop:

- Windows PowerShell:

```powershell
ssh-keygen -t ed25519 -C "you@example.com"
```

Copy the public key contents (e.g., `C:\Users\<You>\.ssh\id_ed25519.pub`) and add it to the droplet’s `~/.ssh/authorized_keys` (use DigitalOcean “Launch Console” if needed):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys   # paste the single-line public key
chmod 600 ~/.ssh/authorized_keys
sudo systemctl restart ssh
```

### Start the tunnel

- Windows (PowerShell):

```powershell
ssh -N -L 5432:127.0.0.1:5432 root@<your-droplet-ip>
```

- macOS/Linux:

```bash
ssh -N -L 5432:127.0.0.1:5432 root@<your-droplet-ip>
```

The command appears to “hang” by design; it is keeping the tunnel open. Open a new terminal to continue working.

#### Verify the tunnel

- Windows:

```powershell
netstat -ano | findstr 5432
```

You should see `LISTENING` on `127.0.0.1:5432`.

- macOS/Linux:

```bash
lsof -i :5432
```

#### Optional: use SSH config

Create `~/.ssh/config` on your workstation:

```
Host droplet
    HostName <your-droplet-ip>
    User root
    IdentityFile C:\Users\<You>\.ssh\id_ed25519
    IdentitiesOnly yes
```

Then start the tunnel with:

```powershell
ssh -N -L 5432:127.0.0.1:5432 droplet
```

#### Optional: ssh-agent (avoid entering passphrase repeatedly)

- Windows (PowerShell as admin):

```powershell
Start-Service ssh-agent
ssh-add C:\Users\<You>\.ssh\id_ed25519
```

- macOS/Linux:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

## 5) TLS options (choose one)

- Option A: SSH tunnel (recommended for development). No TLS configuration needed on PostgreSQL. 5432 remains closed publicly; traffic is encrypted inside SSH.

- Option B: Server-side TLS for PostgreSQL (advanced):

  - Obtain a certificate and key on the server (e.g., `/etc/postgresql/server.crt`, `/etc/postgresql/server.key`).

  - In `postgresql.conf`:

    ```conf
    ssl = on
    ssl_cert_file = '/etc/postgresql/server.crt'
    ssl_key_file  = '/etc/postgresql/server.key'
    ```

  - For strict verification, use a CA-signed cert and distribute the CA to clients.

  - Backend supports:

    - `sslmode=require` (via `DATABASE_URL` query param)
    - Optional strict verification by providing a PEM CA via `DATABASE_CA_CERT`. Without a CA and with `sslmode=require`, some client setups may use `rejectUnauthorized=false` (not recommended for internet-exposed databases).

Recommendation: Prefer SSH tunnels or same-host deployment unless you are comfortable managing TLS and distributing CA trust.

## 6) Backend configuration

Create `backend/.env` with one of the following:

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
# Optional strict verification (PEM contents)
# DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"
ALLOWED_ORIGINS=http://your-frontend-domain
```

Note: If placing certificate files on disk, ensure your code actually loads them; otherwise prefer SSH tunnel or set `DATABASE_CA_CERT` with PEM contents to enforce verification.

## 7) Install dependencies and run migrations

From repo root:

```bash
cd backend
npm install
npm run build
# Example migration scripts in package.json:
# npm run migrate:up
# npm run migrate:status
```

Repository structure:

- SQL migrations in `backend/src/db/migrations/`
- Migration runner: `backend/src/db/migrationRunner.ts` and `backend/src/db/migrate.ts`

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

- Connection refused/timeouts:

  - Verify PostgreSQL is running:

    ```bash
    sudo systemctl status postgresql --no-pager
    sudo ss -tulnp | grep 5432
    ```

  - Check host/port, UFW rules, and `pg_hba.conf` entries.

  - For SSH tunnel: ensure the tunnel process is active and listening locally (`netstat -ano | findstr 5432` on Windows).

- Authentication failed:

  - Re-check role password.
  - Ensure `pg_hba.conf` uses `scram-sha-256` for your user.

- TLS errors:

  - Prefer SSH tunnel for development.
  - For server-side TLS over public networks, use `sslmode=require` and provide a trusted CA via `DATABASE_CA_CERT` if strict verification is required.

- Migrations failing:

  - Confirm user privileges and `DATABASE_URL` points to `pricing_calculator`.

- Windows console encoding warning in `psql`:

  - Run `chcp 1252` before `psql`, or ignore if not dealing with 8-bit characters.

## 10) Verification checklist

- You can connect with psql from your workstation (via SSH tunnel or private/public IP if allowed):

```bash
psql "postgres://app_user:your-password@127.0.0.1:5432/pricing_calculator"
```

- Backend health endpoint returns 200 and shows database healthy.
- Application logs at startup show a successful DB connectivity check.

## Appendix: DigitalOcean private networking (VPC) pattern

If both your API and database run on separate droplets in the same region:

1. Note each droplet’s **private IP** in the DO dashboard.

2. In `postgresql.conf` set:

   ```conf
   listen_addresses = '*'
   ```

3. In `pg_hba.conf`, allow only the API droplet’s **private IP**:

   ```conf
   host  pricing_calculator  app_user  <api-private-ip>/32  scram-sha-256
   ```

4. In UFW, allow 5432 only from that private IP:

   ```bash
   sudo ufw allow from <api-private-ip> to any port 5432 proto tcp
   ```

5. Use the DB droplet’s **private IP** as `PGHOST` in the API environment. No public exposure required.

------

If you want, I can also add a short script/alias section to automate starting the SSH tunnel on Windows (e.g., a `tunnel.ps1` or `npm run tunnel`).
