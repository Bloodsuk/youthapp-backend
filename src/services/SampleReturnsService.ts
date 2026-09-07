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
    fee_label: FEE_LABEL,
    amount_pence: row.amount_pence || FEE_PENCE,
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

async function createAwaitingReturn(orderPk: number): Promise<ISampleReturnRow> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO yr_practitioner_returns
      (order_id, status, amount_pence, tracking_number, qr_data, created_at)
     VALUES (?, 'awaiting_payment', ?, '', '', NOW())`,
    [orderPk, FEE_PENCE]
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
    ret = await createAwaitingReturn(order.id);
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

async function createRoyalMailShipment(
  order: EligibleOrderRow,
  returnId: number
): Promise<{ trackingNumber: string; qrData: string } | null> {
  const clientId = process.env.ROYAL_MAIL_CLIENT_ID || "";
  const clientSecret = process.env.ROYAL_MAIL_CLIENT_SECRET || "";
  const enabled = process.env.ROYAL_MAIL_RETURNS_ENABLED === "1";

  if (!enabled || !clientId || !clientSecret) {
    return null;
  }

  // Optional live Royal Mail Returns API (billable). Only when explicitly enabled.
  const authRes = await fetch("https://api.parcel.royalmail.com/api/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!authRes.ok) {
    throw new Error(`Royal Mail auth failed (${authRes.status})`);
  }
  const authJson = (await authRes.json()) as { access_token?: string };
  if (!authJson.access_token) {
    throw new Error("Royal Mail auth missing access_token");
  }

  const payload = {
    serviceCode: "TSN",
    shipper: {
      companyName: "Youth Revisited",
      addressLine1: "PO Box 689",
      city: "Grimsby",
      postcode: "DN31 9LR",
      countryCode: "GB",
    },
    packages: [
      {
        weightInGrams: 500,
        packageType: "Parcel",
      },
    ],
    recipient: {
      fullName: `${order.fore_name || ""} ${order.sur_name || ""}`.trim() || "Customer",
      addressLine1: order.address || "Address on file",
      city: order.town || "London",
      postcode: order.postal_code || "SW1A 1AA",
      countryCode: "GB",
      emailAddress: order.customer_email,
    },
    reference: `SR-${returnId}-${order.id}`,
  };

  const shipRes = await fetch("https://api.parcel.royalmail.com/api/v1/returns", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authJson.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!shipRes.ok) {
    const body = await shipRes.text();
    throw new Error(`Royal Mail returns failed (${shipRes.status}): ${body.slice(0, 300)}`);
  }
  const shipJson = (await shipRes.json()) as {
    trackingNumber?: string;
    qrCode?: string;
  };
  if (!shipJson.trackingNumber) {
    throw new Error("Royal Mail response missing trackingNumber");
  }
  return {
    trackingNumber: shipJson.trackingNumber,
    qrData: (shipJson.qrCode || "").replace(/^data:image\/png;base64,/, ""),
  };
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

  try {
    const shipment =
      (await createRoyalMailShipment(order, returnId)) ||
      (await createStubShipment(order, returnId));

    await pool.query(
      `UPDATE yr_practitioner_returns
       SET status = 'created',
           tracking_number = ?,
           qr_data = ?,
           posted_at = NULL
       WHERE id = ?`,
      [shipment.trackingNumber, shipment.qrData, returnId]
    );
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
  return toSnapshot(updated, order);
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
