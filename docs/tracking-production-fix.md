# Live tracking — production backend fixes

These fixes are **already in this repo**. Production (`https://prapp.youth-revisited.co.uk`) will keep failing until you **deploy and restart** the API with this code.

## What was wrong on production (old code)

| Bug | Old behavior | Symptom |
|-----|----------------|---------|
| **1. Phleb disconnect** | `handlePhlebDisconnect` deleted all rows in `pleb_live_locations` and emitted `tracking_ended` | Customer sees **404** right after phleb was working (**2 m** → offline) |
| **2. Stale UK GPS** | Integration tests wrote `53.457, -2.74` into live DB | Customer sees **8,578 km** (UK phleb vs Pakistan customer) |
| **3. REST distance** | `GET live_location/:order_id` ignored customer device GPS | Wrong distance when order address is UK but phones are in PK |

## What this repo fixes

1. **`src/socket/trackingSocket.ts`** — On phleb disconnect: **do not delete** GPS rows; **do not** emit `tracking_ended`.
2. **`src/services/PlebLiveLocationService.ts`** — Event-driven GPS:
   - In-memory snapshot on each `update_location` (source of truth).
   - REST / `track_job` snapshot only if GPS is **fresh** (<3 min) and plausible.
   - Never use old test coordinates from DB for customer distance when `track_job` sent live GPS.
3. **`src/controllers/PlebJobController.ts`** — REST accepts `?customer_lat=&customer_lng=` for correct distance.

**No tables or functions removed** — only additive logic on `pleb_live_locations` (tracking table).

## Deploy steps

On the server that runs `prapp.youth-revisited.co.uk`:

```bash
cd /path/to/youthapp-backend
git pull   # branch with these changes
npm ci
npm run build
# restart your process manager, e.g.:
pm2 restart youthapp-backend
# or systemctl restart youthapp-api
```

Confirm logs after restart show on phleb GPS:

```text
[Socket] update_location pleb_id=1267 lat=31.35... lng=73.06... jobs=20286
[Socket] Phleb 1267 disconnected — keeping last GPS in DB until stop_tracking or job ends
```

## One-time: clear stale UK row (optional)

If order `20286` still returns UK coordinates after deploy, run on **production MySQL** (adjust `job_id` / `pleb_id`):

```sql
UPDATE pleb_live_locations pll
JOIN pleb_jobs pj ON pj.id = pll.job_id AND pj.pleb_id = pll.pleb_id
SET pll.lat = 31.3535393, pll.lng = 73.0688578,
    pll.customer_lat = 31.353521, pll.customer_lng = 73.068876,
    pll.updated_at = NOW()
WHERE pj.order_id = 20286;
```

Or from your machine (phleb logged in):

```bash
ORDER_ID=20286 node scripts/seed_live_gps_order.js
```

Keep the phleb app **foreground** for 10+ seconds so the socket stays up until deploy completes.

## Verify

```bash
node scripts/test_flutter_live_integration.js
```

Customer `GET /api/pleb_jobs/live_location/20286?customer_lat=31.35&customer_lng=73.06` should return **meters**, not thousands of km.
