# Visit chat — safe production deploy

This release is **additive**. It does not change existing auth, orders, or GPS tracking socket events.

## What is new

| Area | Change |
|------|--------|
| Database | New table `visit_chat_messages` (`CREATE TABLE IF NOT EXISTS`) |
| REST | `/api/visit_chat/unread`, `/thread/:orderId`, `POST /send` |
| Socket | `visit_chat_*` events on the **same** Socket.io server as GPS |

## What is unchanged

- Phleb `update_location`, customer `track_job` / `stop_track_job`
- JWT auth, cookies, all existing REST routes
- `tracking_auth_ok` still emitted on connect

## Deploy on server

SSH: `youth-revisited-prapp@69.62.124.145`

```bash
cd ~/youthapp-backend   # adjust if your clone lives elsewhere
bash scripts/deploy_visit_chat_production.sh
```

The script: `git pull` → `npm ci` → `npm run build` → run `scripts/create_visit_chat_messages.sql` → `pm2 restart youthapp-backend`.

**Order matters:** run the SQL migration **before** or **with** the restart. If the table is missing, GPS still works; visit chat inbox is skipped until migration runs.

### Manual migration (if env file differs)

```bash
mysql -h 127.0.0.1 -u USER -p practitionermaindb \
  < scripts/create_visit_chat_messages.sql
```

## Smoke test (after deploy)

1. **GPS (must still work)**  
   Phleb app: active job → location updates.  
   Customer: track phleb on map.

2. **Socket auth**  
   Connect should still receive `tracking_auth_ok`.

3. **Visit chat (new)**  
   Open chat on an assigned order → send message → other side receives in realtime.  
   Read receipts: double tick / blue when read.

4. **Closed job**  
   Delivered/Cancelled order → chat opens read-only (no send).

## Rollback

If needed:

```bash
git checkout <previous-commit>
npm ci && npm run build
pm2 restart youthapp-backend
```

Do **not** drop `visit_chat_messages` unless you intend to remove chat data. Old code ignores the table.

## Flutter app

Ensure the app points at production:

- `https://prapp.youth-revisited.co.uk/api/`
- Version **28.0.7+37** (or later with visit chat + live URL)

Build AAB after `flutter clean` if URLs changed recently.
