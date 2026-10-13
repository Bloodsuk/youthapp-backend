/**
 * Smoke test: Sample Returns QR is one-time use (app-side parity with website).
 *
 * Usage:
 *   API_BASE=http://127.0.0.1:7020/api node scripts/smoke_sample_returns_one_time_qr.js
 *
 * Needs a return already at step=return_ready with status=created (usable QR).
 * Optional: SR_RETURN_ID + SR_TOKEN to target a specific return.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../env/live.env") });

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:7020/api").replace(
  /\/$/,
  ""
);
const PHLEB_EMAIL = process.env.PHLEB_EMAIL || "gpsphleb@test.com";
const PHLEB_PASSWORD = process.env.PHLEB_PASSWORD || "phleb";
const ORDER_NUMBER = process.env.SR_ORDER || "697242044";
const CUSTOMER_EMAIL = process.env.SR_EMAIL || "gpscust@test.com";

async function req(method, urlPath, { token, body } = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-key": "prac-youth-120982-7733774-848221",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const results = [];
  const step = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  };

  try {
    console.log(`API_BASE=${API_BASE}`);

    const health = await fetch(API_BASE.replace(/\/api$/, "") + "/api/", {
      method: "GET",
      headers: { Accept: "application/json" },
    }).catch((e) => ({ ok: false, status: 0, error: e }));
    // Just connectivity — 401 is fine
    const login = await req("POST", "/auth/login", {
      body: { email: PHLEB_EMAIL, password: PHLEB_PASSWORD, isPleb: true },
    });
    assert(
      login.status === 200 || login.status === 201,
      `login HTTP ${login.status} — is the API running? ${JSON.stringify(login.json).slice(0, 180)}`
    );
    const token = login.json?.token || login.json?.data?.token;
    assert(token, "login missing token");
    step("phleb login", true, PHLEB_EMAIL);

    let returnId = process.env.SR_RETURN_ID
      ? Number(process.env.SR_RETURN_ID)
      : null;
    let returnToken = process.env.SR_TOKEN || null;
    let snap;

    if (returnId && returnToken) {
      const getOne = await req(
        "GET",
        `/sample_returns/${returnId}?token=${encodeURIComponent(returnToken)}`,
        { token }
      );
      assert(getOne.status === 200 && getOne.json?.success, "get snapshot failed");
      snap = getOne.json.data;
    } else {
      const lookup = await req("POST", "/sample_returns/lookup", {
        token,
        body: { order_number: ORDER_NUMBER, email: CUSTOMER_EMAIL },
      });
      assert(lookup.status === 200 && lookup.json?.success, `lookup failed ${JSON.stringify(lookup.json)}`);
      snap = lookup.json.data;
      returnId = snap.return_id;
      returnToken = snap.token;
    }

    step(
      "loaded return",
      true,
      `id=${returnId} status=${snap.status} step=${snap.step} qr_usable=${snap.qr_usable}`
    );

    // If already posted, verify one-time invariants only
    if (snap.status === "posted" || snap.status === "at_lab" || snap.status === "results") {
      assert(snap.qr_usable === false, "posted return must have qr_usable=false");
      assert(!snap.qr_data, "posted return must not return qr_data");
      step("posted snapshot hides QR", true);

      const email = await req("POST", `/sample_returns/${returnId}/email_qr`, {
        token,
        body: { token: returnToken },
      });
      assert(
        email.status >= 400 || email.json?.success === false,
        "email_qr should fail when already posted"
      );
      step(
        "email_qr blocked when posted",
        true,
        `HTTP ${email.status} ${JSON.stringify(email.json?.data || email.json).slice(0, 120)}`
      );

      const markAgain = await req(
        "POST",
        `/sample_returns/${returnId}/mark_posted`,
        { token, body: { token: returnToken } }
      );
      assert(
        markAgain.status === 200 && markAgain.json?.success === true,
        `idempotent mark_posted failed ${JSON.stringify(markAgain.json)}`
      );
      assert(markAgain.json.data.qr_usable === false, "still unusable after re-mark");
      step("mark_posted idempotent", true);
    } else if (snap.status === "created" || snap.step === "return_ready") {
      // Expect usable QR before mark
      if (snap.qr_usable === undefined) {
        throw new Error(
          "API missing qr_usable — redeploy backend with one-time QR changes first"
        );
      }
      assert(snap.qr_usable === true, "created return should have qr_usable=true");
      assert(snap.qr_data, "created return should include qr_data");
      step("created snapshot has usable QR", true, `qr_len=${String(snap.qr_data).length}`);

      const mark = await req("POST", `/sample_returns/${returnId}/mark_posted`, {
        token,
        body: { token: returnToken },
      });
      assert(
        mark.status === 200 && mark.json?.success === true,
        `mark_posted failed HTTP ${mark.status} ${JSON.stringify(mark.json)}`
      );
      const after = mark.json.data;
      assert(after.status === "posted", `expected status posted got ${after.status}`);
      assert(after.qr_usable === false, "qr_usable must be false after mark_posted");
      assert(!after.qr_data, "qr_data must be null after mark_posted");
      step("mark_posted clears QR", true, after.message || "");

      const getAfter = await req(
        "GET",
        `/sample_returns/${returnId}?token=${encodeURIComponent(returnToken)}`,
        { token }
      );
      assert(getAfter.json?.data?.qr_usable === false, "GET after mark still usable?");
      assert(!getAfter.json?.data?.qr_data, "GET after mark still has qr_data?");
      step("GET snapshot after mark hides QR", true);

      const email = await req("POST", `/sample_returns/${returnId}/email_qr`, {
        token,
        body: { token: returnToken },
      });
      assert(
        email.status >= 400 || email.json?.success === false,
        "email_qr must fail after mark_posted"
      );
      const errMsg =
        email.json?.data?.message ||
        email.json?.error ||
        JSON.stringify(email.json);
      assert(
        /already been used|cannot be emailed/i.test(String(errMsg)),
        `unexpected email error: ${errMsg}`
      );
      step("email_qr blocked after mark_posted", true, String(errMsg).slice(0, 100));
    } else {
      step(
        "one-time QR flow",
        false,
        `return not in created/posted state (status=${snap.status} step=${snap.step}) — create a ready return first`
      );
      throw new Error(`Cannot test one-time QR from status=${snap.status}`);
    }

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.error("\nONE-TIME QR SMOKE FAILED");
      process.exit(1);
    }
    console.log("\nONE-TIME QR SMOKE PASSED");
    process.exit(0);
  } catch (err) {
    console.error("\nONE-TIME QR SMOKE FAILED:", err.message || err);
    process.exit(1);
  }
})();
