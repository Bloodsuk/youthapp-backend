import fetch from "node-fetch";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

const CUSTOMER_TAG = "order-core-php-";
const SALES_TAG = "home-visit-order-to-sale-team";

/** Defaults match current site PHP (ghl-whatsapp-send-to-sales-loop.php). Override via env. */
const DEFAULT_SALES_CONTACT = {
  name: "Osama",
  phone: "+201224622995",
  email: "mohamed.ossama.831@gmail.com",
};

function isEnabled(): boolean {
  const flag = (process.env.GHL_HOME_VISIT_NOTIFY_ENABLED ?? "1")
    .trim()
    .toLowerCase();
  return flag !== "0" && flag !== "false" && flag !== "off";
}

function getCredentials(): { apiKey: string; locationId: string } | null {
  const apiKey = process.env.GHL_KEY?.trim() || "";
  const locationId = process.env.GHL_LOCATION_ID?.trim() || "";
  if (!apiKey || !locationId) {
    return null;
  }
  return { apiKey, locationId };
}

function ghlHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
  };
}

/** UK-style leading 0 → +44; otherwise strip spaces. */
export function normalizeUkPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let phone = raw.replace(/\s+/g, "").trim();
  if (!phone) return null;
  if (phone.startsWith("0")) {
    phone = `+44${phone.slice(1)}`;
  }
  return phone;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function findContactIdByPhone(
  apiKey: string,
  locationId: string,
  phone: string
): Promise<string | null> {
  const url =
    `${GHL_API_BASE}/contacts/search/duplicate?locationId=${encodeURIComponent(locationId)}` +
    `&number=${encodeURIComponent(phone)}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: ghlHeaders(apiKey),
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(
      `[GHL] duplicate search failed (${resp.status}):`,
      text.slice(0, 300)
    );
    return null;
  }

  try {
    const data = JSON.parse(text) as { contact?: { id?: string } };
    const id = data?.contact?.id;
    return id && String(id).trim() ? String(id) : null;
  } catch {
    return null;
  }
}

async function removeTag(
  apiKey: string,
  contactId: string,
  tag: string
): Promise<void> {
  const resp = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: "DELETE",
    headers: ghlHeaders(apiKey),
    body: JSON.stringify({ tags: [tag] }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.warn(
      `[GHL] remove tag failed (${resp.status}) contact=${contactId} tag=${tag}:`,
      text.slice(0, 200)
    );
  }
}

async function upsertContact(
  apiKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  const resp = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: "POST",
    headers: ghlHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(
      `[GHL] contact upsert failed (${resp.status}):`,
      text.slice(0, 300)
    );
    return;
  }
  console.log(`[GHL] contact upsert ok:`, text.slice(0, 200));
}

export interface IHomeVisitCustomerNotifyPayload {
  customerFirstName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerPostcode: string;
  practitionerName: string;
  orderCode: string;
}

/**
 * Same flow as site ghl-whatsapp.php — upsert customer + tag order-core-php-
 * so the GHL workflow sends WhatsApp to the customer.
 */
async function notifyCustomer(
  creds: { apiKey: string; locationId: string },
  payload: IHomeVisitCustomerNotifyPayload
): Promise<void> {
  const phone = normalizeUkPhone(payload.customerPhone);
  if (!phone) {
    console.warn("[GHL] skip customer WhatsApp: missing phone");
    return;
  }

  const existingId = await findContactIdByPhone(
    creds.apiKey,
    creds.locationId,
    phone
  );
  if (existingId) {
    await removeTag(creds.apiKey, existingId, CUSTOMER_TAG);
    await sleep(2000);
  }

  const address = [payload.customerAddress, payload.customerPostcode]
    .filter((p) => p && p.trim())
    .join(", ");

  await upsertContact(creds.apiKey, {
    locationId: creds.locationId,
    firstName: payload.customerFirstName || "Customer",
    phone,
    email: payload.customerEmail || undefined,
    tags: [CUSTOMER_TAG],
    customFields: [
      { key: "customer_name", field_value: payload.customerFirstName || "" },
      {
        key: "practitioner_name",
        field_value: payload.practitionerName || "",
      },
      { key: "customer_address", field_value: address },
      { key: "booking_type", field_value: "Home Visit" },
      { key: "order_id", field_value: payload.orderCode },
    ],
  });
}

/**
 * Same flow as site ghl-whatsapp-send-to-sales-loop.php — tag Mo/sales contact
 * so GHL workflow sends WhatsApp to the sales team.
 */
async function notifySalesTeam(creds: {
  apiKey: string;
  locationId: string;
}): Promise<void> {
  const name =
    process.env.GHL_HOME_VISIT_SALES_NAME?.trim() || DEFAULT_SALES_CONTACT.name;
  const phone =
    process.env.GHL_HOME_VISIT_SALES_PHONE?.trim() ||
    DEFAULT_SALES_CONTACT.phone;
  const email =
    process.env.GHL_HOME_VISIT_SALES_EMAIL?.trim() ||
    DEFAULT_SALES_CONTACT.email;

  const existingId = await findContactIdByPhone(
    creds.apiKey,
    creds.locationId,
    phone
  );
  if (existingId) {
    await removeTag(creds.apiKey, existingId, SALES_TAG);
    await sleep(1000);
  }

  await upsertContact(creds.apiKey, {
    locationId: creds.locationId,
    firstName: name,
    phone,
    email,
    tags: [SALES_TAG],
  });
}

/**
 * Non-fatal: logs errors but does not throw.
 * Triggers GHL WhatsApp for Customer + Mo on new home visit booking.
 */
async function notifyNewHomeVisitBooking(
  payload: IHomeVisitCustomerNotifyPayload
): Promise<void> {
  if (!isEnabled()) {
    console.log("[GHL] home visit notify disabled");
    return;
  }

  const creds = getCredentials();
  if (!creds) {
    console.warn(
      "[GHL] home visit WhatsApp skipped: set GHL_KEY and GHL_LOCATION_ID in env"
    );
    return;
  }

  try {
    await notifyCustomer(creds, payload);
  } catch (error) {
    console.error(
      "[GHL] customer WhatsApp failed:",
      error instanceof Error ? error.message : error
    );
  }

  try {
    await notifySalesTeam(creds);
  } catch (error) {
    console.error(
      "[GHL] sales WhatsApp failed:",
      error instanceof Error ? error.message : error
    );
  }
}

export default {
  normalizeUkPhone,
  notifyNewHomeVisitBooking,
} as const;
