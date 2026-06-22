# Next time — important reference (Youth App backend + live DB)

Keep this handy when picking up the project again.

---

## Repos & URLs

| What | Where |
|------|--------|
| Backend repo | `youthapp-backend` (GitHub: `Bloodsuk/youthapp-backend`, branch `main`) |
| Flutter repo | `youthapp` (branch `dev_deep`) |
| Production API | `https://prapp.youth-revisited.co.uk/api/` |
| Production site / socket | `https://prapp.youth-revisited.co.uk/` |
| Production server SSH | `youth-revisited-prapp@69.62.124.145` |

---

## Environment files (no root `.env`)

Config is in `env/` and loaded by `-e`:

| Command | File | Database |
|---------|------|----------|
| `npm run dev:local` | `env/local.env` | Mac local MySQL |
| `npm run dev:live` | `env/live.env` | Live (only after SSH tunnel) |

**Same credentials, different physical DB:**

```env
DB_HOST=127.0.0.1
DB_USER=znHi3Ozs
PASSWORD=AghhnvPmOfP7aUzT
DATABASE=practitionermaindb
```

`live.env` also has `DB_PROTECTED=1` (blocks DROP/reset scripts).

---

## Connect to LIVE database from your Mac

**Full guide (tunnel + `dev:live` + Flutter ngrok/localhost):**  
→ [`docs/local-backend-live-db-flutter.md`](./local-backend-live-db-flutter.md)

### Step 1 — SSH tunnel (keep terminal open)

```bash
ssh -N -L 3306:127.0.0.1:3306 youth-revisited-prapp@69.62.124.145
```

Or: `./scripts/tunnel-live-db.sh`

**Port conflict:** If local MySQL is on 3306, either:

```bash
brew services stop mysql
# then tunnel on 3306
```

Or tunnel on **3307** (CLI only — app still expects 3306 unless you change code):

```bash
ssh -N -L 3307:127.0.0.1:3306 youth-revisited-prapp@69.62.124.145
```

SSH password: get from team (Mohsin / server admin). Prefer SSH keys long term.

### Step 2 — Start API against live

```bash
npm run dev:live
```

### Step 3 — Expose API to Flutter (pick one)

**Ngrok (phone / external device):**

```bash
ngrok http 7020 --url=https://endearing-disposal-chivalry.ngrok-free.dev
```

Then set `youthapp/lib/Api/urls.dart` to the ngrok URL. See the full guide above.

**Simulator only:** use `http://127.0.0.1:7020/api/` in `urls.dart` (no ngrok).

### Step 4 — Verify you are on LIVE (not local)

```bash
bash scripts/check-live-db.sh
```

| Signal | Local | Live |
|--------|-------|------|
| `@@hostname` | `Osamas-MacBook-Pro.local` | `srv861670` (server name) |
| Orders count | ~2 (test) | thousands (e.g. 19k+) |

**Note:** Homebrew `mysql` CLI may fail with `mysql_native_password` plugin error. Use Node/`mysql2` or the running API instead:

```bash
npm run db:visit-chat-table   # local only
```

---

## Visit chat (realtime)

### What was added (additive — GPS unchanged)

- Table: `visit_chat_messages`
- REST: `/api/visit_chat/unread`, `/thread/:orderId`, `POST /send`
- Socket events: `visit_chat_*` on same Socket.io as GPS

### Create chat table

**Local:**

```bash
npm run db:visit-chat-table
```

**Live (via tunnel or on server):**

```bash
mysql -h 127.0.0.1 -u znHi3Ozs -p practitionermaindb \
  < scripts/create_visit_chat_messages.sql
```

Safe: `CREATE TABLE IF NOT EXISTS` only.

### Production deploy (on server)

**Phleb modules (Kits, Training, Performance, Compliance, profile):**

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"
cd ~/youthapp-backend
ENV_FILE=env/development.env PM2_NAME=youth-backend bash scripts/deploy_phleb_modules_production.sh
```

Pull → `npm ci` → build → **additive** DB migration → `pm2 restart youth-backend`.

Full notes: [`docs/phleb-modules-production-deploy.md`](./phleb-modules-production-deploy.md)

**Visit chat only:**

```bash
cd ~/youthapp-backend
bash scripts/deploy_visit_chat_production.sh
```

Full notes: [`docs/visit-chat-production-deploy.md`](./visit-chat-production-deploy.md)

---

## Flutter app reminders

- API URLs: `youthapp/lib/Api/urls.dart` — see [`local-backend-live-db-flutter.md`](./local-backend-live-db-flutter.md) for local + live DB workflow
- Production: `https://prapp.youth-revisited.co.uk/api/`
- After URL change: `flutter clean` then full run (not hot reload)
- App version for store submit: **28.0.9+39** (`pubspec.yaml`)
- Visit chat is **socket-first**; REST is fallback after ~6s
- **Closed jobs** (Delivered/Cancelled): chat read-only, no send
- **Phleb profile screen:** password field hidden; profile uses `GET/PUT /api/phlebotomists/profile`

### Test logins (live DB)

| Role | Email | Password | Notes |
|------|-------|----------|--------|
| Customer | `gpscust@test.com` | `cust` | Normal login |
| Phleb | `gpsphleb@test.com` | `phleb` | **Sign in as Phleb** only |

(Local test accounts: `testcustomer@local.test` / `testphleb@local.test`, password `test123`.)

---

## Why Cursor/agent sometimes “can’t run SSH”

- Needs **SSH password or private key** — not stored in the repo
- SSH is **interactive** unless using `expect` / `sshpass` with credentials
- Without tunnel, `127.0.0.1` = **local MySQL**, not production
- Agent can run commands **on your machine** if you provide SSH password or keys are loaded

---

## Safety rules

1. Never run `npm run db:local-setup` with `DB_PROTECTED=1` or against live tunnel
2. Visit chat migration is **additive** — does not alter existing tables
3. Do not commit `env/live.env` (gitignored)
4. Do not share SSH/DB passwords in chat — use keys + rotate if leaked
5. GPS socket events (`update_location`, `track_job`) are unchanged by visit chat

---

## Quick smoke test after any deploy

1. Phleb location updates + customer map tracking still work
2. Socket connect → `tracking_auth_ok`
3. Visit chat send/receive + read ticks on active order
4. Closed order → chat opens read-only
5. Phleb modules: training overview, performance, kits, compliance (see [`phleb-modules-production-deploy.md`](./phleb-modules-production-deploy.md))

---

## Useful commands cheat sheet

```bash
# Local dev
npm run dev:local

# Live dev (tunnel must be open first)
npm run dev:live

# Check which DB you hit
bash scripts/check-live-db.sh

# Chat table (local)
npm run db:visit-chat-table

# Build backend
npm run build
```
