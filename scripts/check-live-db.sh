#!/usr/bin/env bash
# Quick check: is 127.0.0.1 pointing at live data or local MySQL?
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/env/live.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/env/live.env"
  set +a
fi

HOST="${DB_HOST:-127.0.0.1}"
USER="${DB_USER:-znHi3Ozs}"
PASS="${DB_PASS:-${PASSWORD:-}}"
DB="${DATABASE:-practitionermaindb}"

if [[ -z "$PASS" ]]; then
  echo "Missing PASSWORD in env/live.env"
  exit 1
fi

echo "Checking $USER@$HOST / $DB ..."
mysql -h "$HOST" -u "$USER" -p"$PASS" "$DB" -N -e "
  SELECT CONCAT('hostname=', @@hostname);
  SELECT CONCAT('orders=', COUNT(*)) FROM orders;
  SELECT CONCAT('phleb_systemtest18=', COUNT(*)) FROM phlebotomy_applications WHERE email='systemtest18@yahoo.com';
" 2>/dev/null

echo ""
echo "Live tunnel OK if hostname is NOT your Mac name and phleb_systemtest18=1"
