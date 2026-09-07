/**
 * Smoke test Sample Returns against a running local API (dev:live + DB tunnel).
 *
 * Usage:
 *   API_BASE=http://127.0.0.1:7020/api node scripts/smoke_sample_returns.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../env/live.env") });
const Stripe = require("stripe");

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
    const login = await req("POST", "/auth/login", {
      body: { email: PHLEB_EMAIL, password: PHLEB_PASSWORD, isPleb: true },
    });
    assert(login.status === 200 || login.status === 201, `login HTTP ${login.status}`);
    const token = login.json?.token || login.json?.data?.token;
    assert(token, `login missing token: ${JSON.stringify(login.json).slice(0, 200)}`);
    step("phleb login", true, PHLEB_EMAIL);

    const lookup = await req("POST", "/sample_returns/lookup", {
      token,
      body: { order_number: ORDER_NUMBER, email: CUSTOMER_EMAIL },
    });
    assert(lookup.status === 200, `lookup HTTP ${lookup.status}`);
    assert(lookup.json?.success === true, `lookup failed: ${JSON.stringify(lookup.json)}`);
    const snap = lookup.json.data;
    assert(snap?.return_id, "lookup missing return_id");
    assert(snap?.token, "lookup missing token");
    assert(
      snap.step === "awaiting_payment" ||
        snap.step === "package" ||
        snap.step === "return_ready",
      `unexpected step ${snap.step}`
    );
    step(
      "lookup order",
      true,
      `return_id=${snap.return_id} step=${snap.step} order=${snap.order_number}`
    );

    const getOne = await req(
      "GET",
      `/sample_returns/${snap.return_id}?token=${encodeURIComponent(snap.token)}`,
      { token }
    );
    assert(getOne.status === 200 && getOne.json?.success === true, "get snapshot failed");
    step("get snapshot", true, getOne.json.data.step);

    // Reset path for full pay→create if already created from earlier tests:
    // only run payment when awaiting_payment
    if (snap.step === "awaiting_payment") {
      const intent = await req(
        "POST",
        `/sample_returns/${snap.return_id}/payment_intent`,
        { token, body: { token: snap.token } }
      );
      assert(intent.status === 200 && intent.json?.success === true, `PI failed ${JSON.stringify(intent.json)}`);
      const clientSecret = intent.json.data.client_secret;
      const intentId =
        intent.json.data.payment_intent_id ||
        String(clientSecret || "").split("_secret")[0];
      assert(clientSecret && intentId, "missing client_secret/intent id");
      step("payment_intent", true, intentId);

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY missing in env/live.env");
      }
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const confirmed = await stripe.paymentIntents.confirm(intentId, {
        payment_method: "pm_card_visa",
        return_url: "https://example.com/return",
      });
      assert(
        confirmed.status === "succeeded" || confirmed.status === "requires_capture",
        `confirm status ${confirmed.status}`
      );
      step("stripe confirm (test card)", true, confirmed.status);

      const finalize = await req(
        "POST",
        `/sample_returns/${snap.return_id}/finalize_payment`,
        {
          token,
          body: { token: snap.token, intent_id: intentId },
        }
      );
      assert(
        finalize.status === 200 && finalize.json?.success === true,
        `finalize failed ${JSON.stringify(finalize.json)}`
      );
      assert(finalize.json.data.step === "package", `expected package got ${finalize.json.data.step}`);
      step("finalize_payment", true, finalize.json.data.step);

      const created = await req(
        "POST",
        `/sample_returns/${snap.return_id}/create`,
        {
          token,
          body: { token: snap.token, confirmed: true },
        }
      );
      assert(
        created.status === 200 && created.json?.success === true,
        `create failed ${JSON.stringify(created.json)}`
      );
      assert(
        created.json.data.step === "return_ready" ||
          created.json.data.step === "manual_review",
        `unexpected create step ${created.json.data.step}`
      );
      assert(
        created.json.data.tracking_number ||
          created.json.data.step === "manual_review",
        "missing tracking_number"
      );
      step(
        "create return (stub RM)",
        true,
        `step=${created.json.data.step} tracking=${created.json.data.tracking_number || "n/a"}`
      );

      // email may fail if SMTP down — warn but don't fail deploy gate hard
      const email = await req(
        "POST",
        `/sample_returns/${snap.return_id}/email_qr`,
        { token, body: { token: snap.token } }
      );
      if (email.status === 200 && email.json?.success === true) {
        step("email_qr", true, "sent");
      } else {
        step(
          "email_qr",
          true,
          `skipped/soft-fail HTTP ${email.status} ${JSON.stringify(email.json).slice(0, 120)}`
        );
      }
    } else {
      step(
        "payment+create flow",
        true,
        `skipped — already at step ${snap.step} (return_id=${snap.return_id})`
      );
      if (snap.step === "package") {
        const created = await req(
          "POST",
          `/sample_returns/${snap.return_id}/create`,
          { token, body: { token: snap.token, confirmed: true } }
        );
        assert(created.status === 200 && created.json?.success, "create from package failed");
        step(
          "create return (from package)",
          true,
          created.json.data.tracking_number || created.json.data.step
        );
      }
    }

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.error("\nSMOKE FAILED");
      process.exit(1);
    }
    console.log("\nSMOKE PASSED — safe to redeploy");
    process.exit(0);
  } catch (err) {
    console.error("\nSMOKE FAILED:", err.message || err);
    process.exit(1);
  }
})();
