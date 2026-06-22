# Phleb modules — safe production deploy

Use this when redeploying **Kits, Training, Performance, Compliance, and Phleb profile** APIs to production.

This release is **additive**. It does not drop, truncate, or modify existing rows in live tables.

---

## Server details

| Item | Value |
|------|--------|
| SSH | `youth-revisited-prapp@69.62.124.145` |
| App directory | `~/youthapp-backend` |
| PM2 process | **`youth-backend`** (not `youthapp-backend`) |
| Node / PM2 path | `~/.nvm/versions/node/v22.17.0/bin` |
| Production API | `https://prapp.youth-revisited.co.uk/api/` |
| DB env on server | `env/development.env` (has `DB_HOST`, `DB_USER`, `PASSWORD`, `DATABASE`) |

Prefer **SSH keys** over passwords. Do not commit or paste server passwords in chat.

---

## One-command deploy (recommended)

SSH into the server, then:

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"
cd ~/youthapp-backend
ENV_FILE=env/development.env PM2_NAME=youth-backend bash scripts/deploy_phleb_modules_production.sh
```

The script runs:

1. `git pull origin main`
2. `npm ci`
3. `npm run build`
4. **Additive DB only** (see below)
5. `pm2 restart youth-backend`

Safe to re-run: migrations are idempotent (`IF NOT EXISTS` / skip if column exists).

---

## What the migration does (safe)

| Change | Type | Existing data |
|--------|------|----------------|
| `npn_phleb_files` | `CREATE TABLE IF NOT EXISTS` | New empty table only |
| `npn_phleb_kit_stock` | `CREATE TABLE IF NOT EXISTS` | New empty table only |
| `npn_kit_requests.priority` | `ADD COLUMN` only if missing | Default `'Normal'` on new column |

**Does not run:** `DROP`, `DELETE`, `TRUNCATE`, or changes to `orders`, `pleb_jobs`, `npn_phleb_training`, etc.

The script prints **orders count before/after** and aborts if the count changes (sanity check).

### APIs that need **no** migration

These use tables that already exist on live:

- Training → `npn_phleb_training`, `npn_phleb_signoffs`, `npn_service_types`
- Performance → `pleb_jobs`, `customer_phleb_bookings`
- Profile → `phlebotomy_applications`

### APIs that need the migration above

- Compliance uploads → `npn_phleb_files`
- Kit balance / urgent requests → `npn_phleb_kit_stock`, `npn_kit_requests.priority`

---

## Manual steps (if the script fails)

### 1. Pull and build

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"
cd ~/youthapp-backend
git pull --ff-only origin main
npm ci
npm run build
```

### 2. Migrations (local scripts, live DB)

On the server (DB is `127.0.0.1` from the app’s perspective):

```bash
# Compliance files table
bash scripts/run_phleb_files_migration.sh development

# Kit stock + priority (idempotent)
bash scripts/run_kit_stock_migration.sh development
```

If `development` env file name differs, set `ENV_FILE` or edit the script’s env path.  
**Do not** use `env/production.env` on this server unless it has real `DB_USER` / `PASSWORD` values.

### 3. Restart API

```bash
pm2 restart youth-backend --update-env
pm2 status youth-backend
pm2 logs youth-backend --lines 50
```

---

## New REST routes (phleb JWT)

| Module | Endpoints |
|--------|-----------|
| Profile | `GET/PUT/PATCH /api/phlebotomists/profile` |
| Kits | `/api/phlebotomists/kits/types`, `balance`, `requests` |
| Training | `/api/phlebotomists/training/overview`, `matrix`, `tasks`, `competency` |
| Performance | `/api/phlebotomists/performance/overview` |
| Compliance | `/api/phlebotomists/compliance/overview`, `items`, `documents` |

Admin document review: `PATCH /api/phlebotomists/compliance/documents/:id/review`

---

## Smoke test (after deploy)

1. **Existing app still works** — customer login, phleb jobs list, GPS tracking, visit chat.
2. **Phleb login** — `gpsphleb@test.com` / `phleb` (Sign in as Phleb).
3. **Training** — matrix + competency load without 404/500.
4. **Performance** — today’s visit stats load.
5. **Kits** — types/balance/requests (may be empty until stock is seeded).
6. **Compliance** — overview + certificate upload.

Quick curl (expect `401` without token — confirms route exists):

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "x-api-key: YOUR_API_KEY" \
  https://prapp.youth-revisited.co.uk/api/phlebotomists/training/overview
```

---

## Flutter app

Point `youthapp/lib/Api/urls.dart` at production:

```dart
const String _kApiRoot = 'https://prapp.youth-revisited.co.uk/api/';
const String _kSiteRoot = 'https://prapp.youth-revisited.co.uk/';
```

After URL change: `flutter clean` then full run (not hot reload).

---

## Optional: seed test data (one phleb only)

For phleb `#1276` / `gpsphleb@test.com` training matrix (dev/demo):

```bash
cd ~/youthapp-backend
node scripts/seed_gpsphleb_training.js
```

Uses DB creds from env — only inserts/updates rows for that phleb id. Review script before running on production.

---

## Rollback

Code only (keep new DB tables — they are harmless if unused):

```bash
cd ~/youthapp-backend
git checkout <previous-commit>
npm ci && npm run build
pm2 restart youth-backend
```

Do **not** drop `npn_phleb_files` or `npn_phleb_kit_stock` unless you intend to remove uploaded compliance files / kit balances.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `pm2: command not found` | `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH"` |
| Migration `Access denied` | Use `ENV_FILE=env/development.env` — `production.env` on server may be empty |
| `production.env` empty DB vars | Server runs with `development.env` via PM2 / `-e development` |
| API 404 on new routes | `git log -1`, `npm run build`, `pm2 restart youth-backend` |
| Compliance upload 500 | Confirm `npn_phleb_files` exists; check `pm2 logs youth-backend` |

---

## Related docs

- [`NEXT-TIME-REFERENCE.md`](./NEXT-TIME-REFERENCE.md) — cheat sheet
- [`local-backend-live-db-flutter.md`](./local-backend-live-db-flutter.md) — Mac + tunnel + ngrok dev workflow
- [`visit-chat-production-deploy.md`](./visit-chat-production-deploy.md) — visit chat deploy (separate script)
