/**
 * Manual test script for Stripe Payment Intent + Checkout flow
 *
 * Prerequisites:
 * - Server running (npm run dev)
 * - Valid user in DB for login
 * - Valid customer_id, test_ids, shipping_type in DB
 * - STRIPE_SECRET_KEY in env (use sk_test_* for test mode)
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/test-stripe-payment-flow.ts
 *
 * Optional env vars:
 *   BASE_URL=http://localhost:7020
 *   LOGIN_EMAIL=your@email.com
 *   LOGIN_PASSWORD=yourpassword
 *   CUSTOMER_ID=1
 *   TEST_IDS=1,2
 *   SHIPPING_TYPE=1
 */

import path from "path";
import dotenv from "dotenv";
import axios, { AxiosInstance } from "axios";
import Stripe from "stripe";

// Load development env
dotenv.config({ path: path.join(__dirname, "../env/development.env") });

const BASE_URL = process.env.BASE_URL || "http://localhost:7020";
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || "";
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || "";
const CUSTOMER_ID = parseInt(process.env.CUSTOMER_ID || "1", 10);
const TEST_IDS = (process.env.TEST_IDS || "1").split(",").map((s) => parseInt(s.trim(), 10));
const SHIPPING_TYPE = parseInt(process.env.SHIPPING_TYPE || "1", 10);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

async function main() {
  console.log("\n=== Stripe Payment Intent + Checkout Flow Test ===\n");
  console.log("Config:", {
    BASE_URL,
    LOGIN_EMAIL: LOGIN_EMAIL ? `${LOGIN_EMAIL.slice(0, 3)}***` : "(not set)",
    CUSTOMER_ID,
    TEST_IDS,
    SHIPPING_TYPE,
  });

  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    console.error(
      "Error: LOGIN_EMAIL and LOGIN_PASSWORD are required.\n" +
        "Set them in env or create a .env file:\n" +
        "  LOGIN_EMAIL=your@email.com\n" +
        "  LOGIN_PASSWORD=yourpassword"
    );
    process.exit(1);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Error: STRIPE_SECRET_KEY is required in env (use sk_test_* for test mode)");
    process.exit(1);
  }

  const api: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: { "Content-Type": "application/json" },
  });

  let token: string;

  // Step 1: Login
  console.log("\n1. Logging in...");
  try {
    const loginRes = await api.post("/api/auth/login", {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    });
    if (!loginRes.data?.token) {
      throw new Error("No token in login response");
    }
    token = loginRes.data.token;
    console.log("   Login OK");
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    console.error("   Login failed:", e.response?.data ?? e.message);
    process.exit(1);
  }

  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  // Step 2: Create Payment Intent
  console.log("\n2. Creating Payment Intent...");
  const orderParams = {
    customer_id: CUSTOMER_ID,
    test_ids: TEST_IDS,
    shipping_type: SHIPPING_TYPE,
    service_ids: [] as number[],
    discount: 0,
    current_medication: "",
    last_trained: "",
    fasted: "",
    hydrated: "",
    drank_alcohol: "",
    drugs_taken: "",
    supplements: "",
    enhancing_drugs: "",
    booking: {},
  };

  let paymentIntentId: string;
  let expectedAmount: number;

  try {
    const piRes = await api.post("/api/orders/stripe/payment_intent", orderParams);
    paymentIntentId = piRes.data.payment_intent_id;
    expectedAmount = piRes.data.amount;
    console.log("   Payment Intent created:", paymentIntentId);
    console.log("   Amount:", expectedAmount, piRes.data.currency);
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    console.error("   Payment Intent failed:", e.response?.data ?? e.message);
    process.exit(1);
  }

  // Step 3: Confirm PaymentIntent with Stripe test token (pm_card_visa)
  console.log("\n3. Confirming payment with Stripe (test token pm_card_visa)...");
  const returnUrl = piRes.data.return_url || "https://example.com/orders/complete";
  try {
    await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: "pm_card_visa",
      return_url,
    });

    console.log("   Payment confirmed successfully");
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("   Stripe confirm failed:", e.message);
    process.exit(1);
  }

  // Step 4: Checkout with payment_intent_id
  console.log("\n4. Calling stripe_checkout with payment_intent_id...");
  try {
    const checkoutRes = await api.post("/api/orders/stripe_checkout", {
      ...orderParams,
      payment_intent_id: paymentIntentId,
    });

    console.log("   Checkout OK!");
    console.log("   Order ID:", checkoutRes.data.order_id);
    console.log("   Order number:", checkoutRes.data.order_number);
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    console.error("   Checkout failed:", e.response?.data ?? e.message);
    process.exit(1);
  }

  console.log("\n=== All steps passed! ===\n");
}

main();
