# Local backend + live database + Flutter (future reference)

Use this when you want to run the **API on your Mac** against the **production MySQL** database, and point the **Flutter app** at your laptop (via ngrok or simulator localhost).

---

## What you are building

```
┌─────────────┐     ngrok / localhost      ┌──────────────────┐
│ Flutter app │ ─────────────────────────► │ Mac backend      │
│ (youthapp)  │   https://….ngrok…/api/    │ npm run dev:live │
└─────────────┘                            │ port 7020        │
                                           └────────┬─────────┘
                                                    │ 127.0.0.1:3306
                                           ┌────────▼─────────┐
                                           │ SSH tunnel       │
                                           └────────┬─────────┘
                                                    │
                                           ┌────────▼─────────┐
                                           │ Live MySQL       │
                                           │ (production DB)  │
                                           └──────────────────┘
```

- **Backend** reads `env/live.env` (`DB_PROTECTED=1`, same credentials as server).
- **Tunnel** makes `127.0.0.1:3306` on your Mac forward to MySQL on the server.
- **Flutter** must not use the production API URL while testing local code — switch `urls.dart` (see below).

---

## Prerequisites

| Item | Notes |
|------|--------|
| Backend repo | `youthapp-backend` |
| Flutter repo | `youthapp` (branch `dev_deep`) |
| SSH access | `youth-revisited-prapp@69.62.124.145` |
| ngrok (optional) | Reserved domain: `endearing-disposal-chivalry.ngrok-free.dev` |
| Port 3306 free | Stop local MySQL if it conflicts: `brew services stop mysql` |

---

## Step-by-step (3 terminals)

### Terminal 1 — SSH tunnel (keep open)

```bash
cd /path/to/youthapp-backend
./scripts/tunnel-live-db.sh
```

Equivalent manual command:

```bash
ssh -N -L 3306:127.0.0.1:3306 youth-revisited-prapp@69.62.124.145
```

**Important:** Leave this terminal running. If the tunnel closes, the backend loses DB access (`ECONNREFUSED 127.0.0.1:3306`).

Do **not** use short-lived tunnel scripts with a 30s timeout — the tunnel must stay up for the whole dev session.

### Terminal 2 — Local backend (live DB)

```bash
cd /path/to/youthapp-backend
npm run dev:live
```

Expect: `Database connection successful` and API on **port 7020**.

Verify which DB you hit:

```bash
bash scripts/check-live-db.sh
```

| Signal | Local MySQL | Live (via tunnel) |
|--------|-------------|-------------------|
| `@@hostname` | e.g. `Osamas-MacBook-Pro.local` | e.g. `srv861670` |
| Orders | few test rows | thousands |

### Terminal 3 — ngrok (physical device or external testing)

```bash
ngrok http 7020 --url=https://endearing-disposal-chivalry.ngrok-free.dev
```

Skip ngrok if you only use the **iOS Simulator / Android emulator** and point Flutter at `http://127.0.0.1:7020/api/` (see Flutter section).

---

## Flutter: point app at local backend

File: `youthapp/lib/Api/urls.dart`

### Option A — ngrok (device on same network / real phone)

Uncomment ngrok block, comment production:

```dart
// const String _kApiRoot = 'https://prapp.youth-revisited.co.uk/api/';
// const String _kSiteRoot = 'https://prapp.youth-revisited.co.uk/';

const String _kApiRoot = 'https://endearing-disposal-chivalry.ngrok-free.dev/api/';
const String _kSiteRoot = 'https://endearing-disposal-chivalry.ngrok-free.dev/';
```

### Option B — Simulator only (no ngrok)

```dart
const String _kApiRoot = 'http://127.0.0.1:7020/api/';
const String _kSiteRoot = 'http://127.0.0.1:7020/';
```

Android emulator may need `http://10.0.2.2:7020/api/` instead of `127.0.0.1`.

### After any URL change

```bash
cd /path/to/youthapp
flutter clean
flutter run   # full restart — hot reload is not enough
```

---

## Test accounts (live DB via tunnel)

| Role | Email | Password | Login path |
|------|-------|----------|------------|
| Phleb | `gpsphleb@test.com` | `phleb` | **Sign in as Phleb** |
| Customer | `gpscust@test.com` | `cust` | Normal login |

Phlebs must **not** use the regular customer login — auth isolation blocks that on production and local-with-live-DB.

Local-only seeds (when using `npm run dev:local`):

| Role | Email | Password |
|------|-------|----------|
| Phleb | `testphleb@local.test` | `test123` |
| Customer | `testcustomer@local.test` | `test123` |

---

## Quick health checks

```bash
# Tunnel listening?
lsof -i :3306

# Backend listening?
lsof -i :7020

# API responds (401 without token is OK)
curl -s -o /dev/null -w "%{http_code}\n" \
  https://endearing-disposal-chivalry.ngrok-free.dev/api/homepage

# Or direct to laptop
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:7020/api/homepage
```

Phleb login smoke test:

```bash
curl -s -X POST 'http://127.0.0.1:7020/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"gpsphleb@test.com","password":"phleb","isPleb":true}'
```

---

## Common errors

| Error | Cause | Fix |
|-------|--------|-----|
| `ECONNREFUSED 127.0.0.1:3306` | SSH tunnel down | Re-run `./scripts/tunnel-live-db.sh` |
| `EADDRINUSE :7020` | Multiple backends | `lsof -ti :7020 \| xargs kill -9` then one `npm run dev:live` |
| `ERR_NGROK_3200` | ngrok not running or wrong URL | Start ngrok; match URL in `urls.dart` |
| Login `password:""` / 401 | Empty password sent | Use correct password; phleb via **Sign in as Phleb** |
| App still hits production | Stale compile | `flutter clean` + full restart |
| `check-live-db` shows Mac hostname | Tunnel not active | Open tunnel; restart `dev:live` |

---

## Switch back to production API (store build / live testing)

In `urls.dart`, restore:

```dart
const String _kApiRoot = 'https://prapp.youth-revisited.co.uk/api/';
const String _kSiteRoot = 'https://prapp.youth-revisited.co.uk/';
```

Comment out ngrok lines. Run `flutter clean` before release builds.

---

## Safety

1. `env/live.env` has `DB_PROTECTED=1` — destructive DB scripts are blocked.
2. Do not run `db:local-setup` while tunnelled to live.
3. Do not commit `env/live.env` (gitignored).
4. Prefer SSH keys over passwords in scripts.

---

## Related docs

- `docs/NEXT-TIME-REFERENCE.md` — cheat sheet + deploy notes
- `docs/safe-database.md` — DB protection rules
- `scripts/tunnel-live-db.sh` — tunnel helper
- `scripts/check-live-db.sh` — verify live vs local DB
