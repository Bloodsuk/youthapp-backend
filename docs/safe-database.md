# Live database from your Mac (safe — no DROP / delete scripts)

## Why `DB_HOST=127.0.0.1` is still “live”

On the **production server**, the Node app and MySQL run on the same machine, so the live app uses:

```env
DB_HOST=127.0.0.1
DB_USER=znHi3Ozs
DATABASE=practitionermaindb
```

Those are the real live credentials.

On **your Mac**, `127.0.0.1:3306` is usually **your own MySQL** (Homebrew), not the server — unless you open an **SSH tunnel** first.

Check what you are connected to:

```bash
mysql -h 127.0.0.1 -u znHi3Ozs -p practitionermaindb -e "SELECT @@hostname;"
```

| `@@hostname` | Meaning |
|----------------|---------|
| `Osamas-MacBook-Pro.local` (or your Mac name) | Local MySQL — not production |
| Server hostname (e.g. cloud VM name) | Tunnel or remote — live data |

Also check row counts: live production has many orders/customers; a fresh local copy often has only a few test rows.

## Connect your laptop to live (recommended)

**1. SSH tunnel** (get SSH user/host from your team):

```bash
ssh -N -L 3306:127.0.0.1:3306 YOUR_USER@YOUR_LIVE_SERVER_HOST
```

Leave that terminal open. Then `127.0.0.1` on your Mac forwards to live MySQL on the server.

**2. Start API with live env** (credentials + production JWT + protection):

```bash
npm run dev:live
```

Uses `env/live.env` — includes `DB_PROTECTED=1`.

**3. ngrok + Flutter** (unchanged):

```bash
ngrok http 7020
```

Point the app at the ngrok URL. Log in with **real live** phleb/customer accounts (not `testphleb@local.test` unless they exist on live).

## What cannot break live data

| Action | Safe on live? |
|--------|----------------|
| `npm run dev:live` | Yes — normal API read/write only |
| `npm run db:local-setup` | **Blocked** when `DB_PROTECTED=1` or non-local host |
| Manual `DROP DATABASE` | Never on live |

`env/live.env` is gitignored. It sets `DB_PROTECTED=1` so reset scripts refuse to run.

## `env/local.env` vs `env/live.env`

| File | Use |
|------|-----|
| `local.env` | Disposable MySQL on your Mac for testing |
| `live.env` | Live credentials + production JWT + `DB_PROTECTED=1` |

Same username/password/database name; different **physical** database until the SSH tunnel is up.
