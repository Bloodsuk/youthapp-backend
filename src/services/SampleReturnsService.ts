import crypto from "crypto";
import Stripe from "stripe";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import QRCode from "qrcode";

import EnvVars from "@src/constants/EnvVars";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import {
  ISampleReturnRow,
  ISampleReturnSnapshot,
  SampleReturnStatus,
  SampleReturnStep,
} from "@src/interfaces/ISampleReturn";
import { RouteError } from "@src/other/classes";
import { pool } from "@src/server";
import MailService from "@src/services/MailService";

const FEE_PENCE = 395;
const FEE_LABEL = "£3.95";
const ELIGIBLE_STATUSES = ["Started", "Shipped", "Processing"];
const ELIGIBLE_SHIPPING = ["2", "5", "7", "9"];

type EligibleOrderRow = {
  id: number;
  order_id: string;
  status: string;
  shipping_type: string | null;
  id_on_wp: number | null;
  customer_id: number;
  customer_email: string;
  fore_name: string | null;
  sur_name: string | null;
  address: string | null;
  town: string | null;
  postal_code: string | null;
  country: string | null;
};

function tokenSecret(): string {
  return EnvVars.Jwt.Secret || EnvVars.CookieProps.Secret || "sample-returns";
}

function makeToken(returnId: number): string {
  const sig = crypto
    .createHmac("sha256", tokenSecret())
    .update(String(returnId))
    .digest("hex");
  return `${returnId}.${sig}`;
}

function assertToken(returnId: number, token: string | undefined): void {
  if (!token || token !== makeToken(returnId)) {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "Invalid return token");
  }
}

function normalizeOrderNumber(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, "")
    .replace(/^YRV-/i, "")
    .trim();
}

function displayOrderNumber(orderIdField: string): string {
  const cleaned = String(orderIdField || "").trim();
  if (!cleaned) return "";
  if (/^#?YRV-/i.test(cleaned)) {
    return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
  }
  return `#YRV-${cleaned}`;
}

function isEligibleShipping(shippingType: string | null | undefined): boolean {
  if (shippingType == null) return true;
  const t = String(shippingType).trim();
  if (t === "") return true;
  return ELIGIBLE_SHIPPING.includes(t);
}

function stepFromStatus(status: SampleReturnStatus): SampleReturnStep {
  switch (status) {
    case "awaiting_payment":
      return "awaiting_payment";
    case "requested":
      return "package";
    case "created":
    case "posted":
    case "at_lab":
    case "results":
      return "return_ready";
    case "manual_review":
      return "manual_review";
    default:
      return "awaiting_payment";
  }
}

function toSnapshot(
  row: ISampleReturnRow,
  order: EligibleOrderRow,
  message?: string | null
): ISampleReturnSnapshot {
  const amount = Number(row.amount_pence ?? FEE_PENCE);
  return {
    return_id: row.id,
    token: makeToken(row.id),
    step: stepFromStatus(row.status),
    status: row.status,
    order_number: displayOrderNumber(order.order_id),
    order_id: order.id,
    customer_email: order.customer_email,
    tracking_number: row.tracking_number || null,
    qr_data: row.qr_data || null,
    fee_label: amount > 0 ? FEE_LABEL : "Waived",
    amount_pence: amount,
    message: message ?? null,
  };
}

async function findEligibleOrder(
  orderNumber: string,
  email: string
): Promise<EligibleOrderRow | null> {
  const normalized = normalizeOrderNumber(orderNumber);
  if (!normalized || !email.trim()) return null;

  const emailNorm = email.trim().toLowerCase();
  const asId = /^\d+$/.test(normalized) ? Number(normalized) : null;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_id, o.status, o.shipping_type, o.id_on_wp, o.customer_id,
            c.email AS customer_email, c.fore_name, c.sur_name,
            c.address, c.town, c.postal_code, c.country
     FROM orders o
     INNER JOIN customers c ON c.id = o.customer_id
     WHERE LOWER(TRIM(c.email)) = ?
       AND (o.id_on_wp IS NULL OR o.id_on_wp = 0)
       AND o.status IN (?, ?, ?)
       AND (
         o.order_id = ?
         OR o.order_id = ?
         OR (? IS NOT NULL AND o.id = ?)
       )
     LIMIT 1`,
    [
      emailNorm,
      ELIGIBLE_STATUSES[0],
      ELIGIBLE_STATUSES[1],
      ELIGIBLE_STATUSES[2],
      normalized,
      orderNumber.trim().replace(/^#/, ""),
      asId,
      asId,
    ]
  );

  if (rows.length === 0) return null;
  const row = rows[0] as EligibleOrderRow;
  if (!isEligibleShipping(row.shipping_type)) return null;
  return row;
}

async function getReturnById(returnId: number): Promise<ISampleReturnRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM yr_practitioner_returns WHERE id = ? LIMIT 1",
    [returnId]
  );
  if (rows.length === 0) return null;
  return rows[0] as ISampleReturnRow;
}

async function getReturnByOrderId(
  orderPk: number
): Promise<ISampleReturnRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM yr_practitioner_returns WHERE order_id = ? ORDER BY id DESC LIMIT 1",
    [orderPk]
  );
  if (rows.length === 0) return null;
  return rows[0] as ISampleReturnRow;
}

async function loadOrderForReturn(
  orderPk: number
): Promise<EligibleOrderRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_id, o.status, o.shipping_type, o.id_on_wp, o.customer_id,
            c.email AS customer_email, c.fore_name, c.sur_name,
            c.address, c.town, c.postal_code, c.country
     FROM orders o
     INNER JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ?
     LIMIT 1`,
    [orderPk]
  );
  if (rows.length === 0) return null;
  return rows[0] as EligibleOrderRow;
}

async function createPhlebReturn(orderPk: number): Promise<ISampleReturnRow> {
  // Phleb Sample Returns: fee payment skipped for now (product decision).
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO yr_practitioner_returns
      (order_id, status, amount_pence, tracking_number, qr_data, created_at, paid_at)
     VALUES (?, 'requested', 0, '', '', NOW(), NOW())`,
    [orderPk]
  );
  const created = await getReturnById(result.insertId);
  if (!created) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Could not create return record"
    );
  }
  return created;
}

async function waivePaymentIfNeeded(
  ret: ISampleReturnRow
): Promise<ISampleReturnRow> {
  if (ret.status !== "awaiting_payment") return ret;
  await pool.query(
    `UPDATE yr_practitioner_returns
     SET status = 'requested',
         amount_pence = 0,
         paid_at = COALESCE(paid_at, NOW())
     WHERE id = ? AND status = 'awaiting_payment'`,
    [ret.id]
  );
  return (await getReturnById(ret.id)) || ret;
}

async function lookupOrder(
  orderNumber: string,
  email: string
): Promise<ISampleReturnSnapshot> {
  const order = await findEligibleOrder(orderNumber, email);
  if (!order) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      "We could not find a matching order. Please check your details and try again."
    );
  }

  let ret = await getReturnByOrderId(order.id);
  if (!ret) {
    ret = await createPhlebReturn(order.id);
  } else {
    ret = await waivePaymentIfNeeded(ret);
  }

  return toSnapshot(ret, order);
}

async function getSnapshot(
  returnId: number,
  token: string
): Promise<ISampleReturnSnapshot> {
  assertToken(returnId, token);
  const ret = await getReturnById(returnId);
  if (!ret) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Return not found");
  }
  const order = await loadOrderForReturn(ret.order_id);
  if (!order) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Order not found for return");
  }
  return toSnapshot(ret, order);
}

function getStripe(): Stripe {
  if (!EnvVars.Stripe.Secret) {
    throw new RouteError(
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      "Stripe is not configured"
    );
  }
  return new Stripe(EnvVars.Stripe.Secret);
}

async function createPaymentIntent(
  returnId: number,
  token: string
): Promise<{ client_secret: string; payment_intent_id: string; snapshot: ISampleReturnSnapshot }> {
  assertToken(returnId, token);
  const ret = await getReturnById(returnId);
  if (!ret) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Return not found");
  }
  if (ret.status !== "awaiting_payment") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Return is not awaiting payment"
    );
  }

  const order = await loadOrderForReturn(ret.order_id);
  if (!order) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Order not found for return");
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: FEE_PENCE,
    currency: "gbp",
    payment_method_types: ["card"],
    metadata: {
      purpose: "sample_return",
      return_id: String(returnId),
      order_id: String(order.id),
      order_number: order.order_id,
    },
  });

  await pool.query(
    "UPDATE yr_practitioner_returns SET stripe_payment_intent_id = ? WHERE id = ?",
    [intent.id, returnId]
  );

  const updated = (await getReturnById(returnId))!;
  return {
    client_secret: intent.client_secret || "",
    payment_intent_id: intent.id,
    snapshot: toSnapshot(updated, order),
  };
}

async function finalizePayment(
  returnId: number,
  token: string,
  intentId: string
): Promise<ISampleReturnSnapshot> {
  assertToken(returnId, token);
  const ret = await getReturnById(returnId);
  if (!ret) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Return not found");
  }

  const order = await loadOrderForReturn(ret.order_id);
  if (!order) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Order not found for return");
  }

  if (ret.status !== "awaiting_payment") {
    return toSnapshot(ret, order);
  }

  if (!intentId) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "intent_id is required");
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (intent.status !== "succeeded") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      `Payment not completed (status: ${intent.status})`
    );
  }
  if (intent.amount !== FEE_PENCE) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Payment amount mismatch");
  }

  await pool.query(
    `UPDATE yr_practitioner_returns
     SET status = 'requested',
         stripe_payment_intent_id = ?,
         paid_at = NOW()
     WHERE id = ?`,
    [intent.id, returnId]
  );

  const updated = (await getReturnById(returnId))!;
  return toSnapshot(updated, order);
}

async function createRoyalMailViaWordpress(
  returnId: number,
  token: string
): Promise<{ ok: boolean; message?: string }> {
  const url =
    process.env.SAMPLE_RETURNS_CREATE_RETURN_URL ||
    "https://www.practitioner.youth-revisited.co.uk/create-return.php";

  const body = new URLSearchParams({
    return_id: String(returnId),
    confirmed: "true",
    // Website endpoints also accept token; harmless if practitioner ignores it.
    token,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const text = await res.text();
  let json: { success?: boolean; data?: { message?: string } } = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `WordPress create-return returned non-JSON (${res.status}): ${text.slice(0, 200)}`
    );
  }

  if (!res.ok || json.success !== true) {
    return {
      ok: false,
      message:
        json.data?.message ||
        `WordPress create-return failed (${res.status})`,
    };
  }
  return { ok: true };
}

async function createStubShipment(
  order: EligibleOrderRow,
  _returnId: number
): Promise<{ trackingNumber: string; qrData: string }> {
  const trackingNumber = `RM${String(order.id).padStart(9, "0")}GB`;
  const qrPayload = `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber}`;
  const qrData = await QRCode.toDataURL(qrPayload, {
    type: "image/png",
    margin: 1,
  });
  return {
    trackingNumber,
    qrData: qrData.replace(/^data:image\/png;base64,/, ""),
  };
}

async function confirmAndCreateReturn(
  returnId: number,
  token: string,
  confirmed: boolean
): Promise<ISampleReturnSnapshot> {
  assertToken(returnId, token);
  if (!confirmed) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Packaging must be confirmed"
    );
  }

  const ret = await getReturnById(returnId);
  if (!ret) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Return not found");
  }
  const order = await loadOrderForReturn(ret.order_id);
  if (!order) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Order not found for return");
  }

  if (ret.status === "created" || ret.status === "posted" || ret.status === "at_lab" || ret.status === "results") {
    return toSnapshot(ret, order);
  }

  if (ret.status !== "requested") {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Return must be paid before creating the shipment"
    );
  }

  // Option A (required): WordPress create-return.php talks to Royal Mail and
  // updates yr_practitioner_returns with real tracking_number + qr_data.
  try {
    const wp = await createRoyalMailViaWordpress(returnId, token);
    if (!wp.ok) {
      // Dev/local escape hatch only — never use for real customer returns.
      if (process.env.SAMPLE_RETURNS_ALLOW_STUB === "1") {
        console.warn(
          "[SampleReturns] WP create-return failed; using stub because SAMPLE_RETURNS_ALLOW_STUB=1:",
          wp.message
        );
        const shipment = await createStubShipment(order, returnId);
        await pool.query(
          `UPDATE yr_practitioner_returns
           SET status = 'created',
               tracking_number = ?,
               qr_data = ?,
               posted_at = NULL
           WHERE id = ?`,
          [shipment.trackingNumber, shipment.qrData, returnId]
        );
      } else {
        throw new Error(wp.message || "WordPress create-return failed");
      }
    } else {
      // Re-read what WP wrote into the shared returns table.
      const after = await getReturnById(returnId);
      if (
        !after ||
        !after.tracking_number ||
        after.status === "requested" ||
        after.status === "awaiting_payment"
      ) {
        throw new Error(
          "WordPress create-return succeeded but return was not updated with tracking"
        );
      }
    }
  } catch (err) {
    console.error("[SampleReturns] create shipment failed", err);
    await pool.query(
      `UPDATE yr_practitioner_returns SET status = 'manual_review' WHERE id = ?`,
      [returnId]
    );
    const updated = (await getReturnById(returnId))!;
    return toSnapshot(
      updated,
      order,
      "Something needs a manual check. Please contact Youth Revisited."
    );
  }

  const updated = (await getReturnById(returnId))!;
  const snapshot = toSnapshot(updated, order);

  // First "return ready" email (matches app Ready UI). Failures shouldn't block create.
  if (updated.tracking_number) {
    try {
      await MailService.sendSampleReturnQrEmail({
        to: order.customer_email,
        orderNumber: snapshot.order_number,
        trackingNumber: updated.tracking_number,
        qrDataBase64: updated.qr_data || "",
      });
    } catch (mailErr) {
      console.error("[SampleReturns] ready email failed", mailErr);
    }
  }

  return snapshot;
}

async function emailQr(
  returnId: number,
  token: string
): Promise<{ emailed: boolean }> {
  assertToken(returnId, token);
  const ret = await getReturnById(returnId);
  if (!ret) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Return not found");
  }
  if (!ret.tracking_number) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Return is not ready to email yet"
    );
  }
  const order = await loadOrderForReturn(ret.order_id);
  if (!order) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Order not found for return");
  }

  await MailService.sendSampleReturnQrEmail({
    to: order.customer_email,
    orderNumber: displayOrderNumber(order.order_id),
    trackingNumber: ret.tracking_number,
    qrDataBase64: ret.qr_data || "",
  });

  return { emailed: true };
}

export default {
  FEE_PENCE,
  FEE_LABEL,
  lookupOrder,
  getSnapshot,
  createPaymentIntent,
  finalizePayment,
  confirmAndCreateReturn,
  emailQr,
} as const;
