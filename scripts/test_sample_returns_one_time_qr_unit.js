/**
 * Unit contract tests for Sample Returns one-time QR rules
 * (mirrors SampleReturnsService isQrUsable / toSnapshot / emailQr gates).
 *
 * Run: node scripts/test_sample_returns_one_time_qr_unit.js
 */
function isQrUsable(status) {
  return status === "created";
}

function snapshotQrFields(status, qrData) {
  const qrUsable = isQrUsable(status);
  return {
    status,
    qr_usable: qrUsable,
    qr_data: qrUsable ? qrData || null : null,
  };
}

function canEmailQr(status, hasTracking, hasQrData) {
  if (!isQrUsable(status)) {
    return { ok: false, reason: "already been used" };
  }
  if (!hasTracking || !hasQrData) {
    return { ok: false, reason: "not ready" };
  }
  return { ok: true };
}

function canMarkPosted(status) {
  if (status === "posted" || status === "at_lab" || status === "results") {
    return { ok: true, idempotent: true };
  }
  if (status !== "created") {
    return { ok: false, reason: "only created" };
  }
  return { ok: true, idempotent: false };
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.log("FAIL ", msg);
  } else {
    console.log("PASS ", msg);
  }
}

assert(isQrUsable("created") === true, "created => usable");
assert(isQrUsable("posted") === false, "posted => not usable");
assert(isQrUsable("at_lab") === false, "at_lab => not usable");
assert(isQrUsable("results") === false, "results => not usable");
assert(isQrUsable("requested") === false, "requested => not usable");

const ready = snapshotQrFields("created", "base64png");
assert(ready.qr_usable === true && ready.qr_data === "base64png", "snapshot keeps QR when created");

const posted = snapshotQrFields("posted", "base64png");
assert(posted.qr_usable === false && posted.qr_data === null, "snapshot strips QR when posted");

assert(canEmailQr("created", true, true).ok === true, "email allowed when created+ready");
assert(
  /already been used/.test(canEmailQr("posted", true, true).reason || ""),
  "email blocked when posted"
);
assert(canEmailQr("created", false, true).ok === false, "email blocked without tracking");

assert(canMarkPosted("created").ok === true && !canMarkPosted("created").idempotent, "mark from created");
assert(canMarkPosted("posted").ok === true && canMarkPosted("posted").idempotent, "mark idempotent when posted");
assert(canMarkPosted("requested").ok === false, "mark blocked from requested");

if (failed) {
  console.error(`\nUNIT FAILED (${failed})`);
  process.exit(1);
}
console.log("\nUNIT PASSED — one-time QR contract OK");
process.exit(0);
