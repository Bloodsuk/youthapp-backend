/**
 * Verifies practitioner and phlebotomist logins are isolated by isPleb flag.
 * The same email may exist in both users and phlebotomy_applications with different passwords.
 *
 * Usage:
 *   API_BASE=https://prapp.youth-revisited.co.uk/api \
 *   PHLEB_EMAIL=gpsphleb@test.com PHLEB_PASSWORD=phleb \
 *   PRACT_EMAIL=gpsphleb@test.com PRACT_PASSWORD=wrong \
 *   node scripts/test_phleb_login_isolation.js
 */
const API_BASE = (process.env.API_BASE || "http://127.0.0.1:3000/api").replace(
  /\/$/,
  ""
);
const PHLEB_EMAIL = process.env.PHLEB_EMAIL || "testphleb@local.test";
const PHLEB_PASSWORD = process.env.PHLEB_PASSWORD || "test123";

async function login(body) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function jwtLevel(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8")
    );
    return payload.user_level;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`API: ${API_BASE}`);
  console.log(`Phleb email: ${PHLEB_EMAIL}\n`);

  const regular = await login({
    email: PHLEB_EMAIL,
    password: PHLEB_PASSWORD,
  });
  console.log("1) Regular login (no isPleb):");
  console.log(`   HTTP ${regular.status}`);
  console.log(`   success: ${regular.data.success}`);
  console.log(`   message: ${regular.data.message || "(none)"}`);
  console.log(`   jwt user_level: ${jwtLevel(regular.data.token) || "(no token)"}`);

  const pleb = await login({
    email: PHLEB_EMAIL,
    password: PHLEB_PASSWORD,
    isPleb: true,
  });
  console.log("\n2) Phleb login (isPleb: true):");
  console.log(`   HTTP ${pleb.status}`);
  console.log(`   success: ${pleb.data.success}`);
  console.log(`   message: ${pleb.data.message || "(none)"}`);
  console.log(`   jwt user_level: ${jwtLevel(pleb.data.token) || "(no token)"}`);

  const regularOk = regular.data.success === true;
  const plebOk = pleb.data.success === true;
  const plebJwt = jwtLevel(pleb.data.token);
  const regularJwt = jwtLevel(regular.data.token);

  console.log("\n--- Result ---");
  if (regularOk && regularJwt === "Phlebotomist") {
    console.error("FAIL: Regular login returned Phlebotomist JWT.");
    process.exit(1);
  }
  if (plebOk && plebJwt !== "Phlebotomist") {
    console.error(`FAIL: Phleb login JWT user_level is "${plebJwt}", expected Phlebotomist.`);
    process.exit(1);
  }
  if (plebOk) {
    console.log("PASS: Phleb login returns Phlebotomist JWT when isPleb: true.");
  }
  if (!plebOk) {
    console.warn("WARN: Phleb login failed (check credentials).");
  }
  if (regularOk) {
    console.log("PASS: Practitioner/customer login succeeded without isPleb (same email allowed in both tables).");
  } else {
    console.log("INFO: Regular login did not succeed (expected if no matching users/customers row or wrong password).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
