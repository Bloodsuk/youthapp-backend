import crypto from "crypto";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { RouteError } from "@src/other/classes";
import { pool } from "@src/server";

const TOKEN_TTL_SECONDS = 120;

function partnerLoginUrl(): string {
  return (
    process.env.PARTNER_LOGIN_URL?.trim() ||
    "https://www.youth-revisited.co.uk/partner-login/"
  );
}

function partnerSignupUrl(): string {
  return (
    process.env.PARTNER_SIGNUP_URL?.trim() ||
    "https://www.youth-revisited.co.uk/partner-register/"
  );
}

function partnerWpApiUrl(): string {
  return (
    process.env.PARTNER_WP_API_URL?.trim() ||
    "https://www.youth-revisited.co.uk/wp-json/yr/v1"
  );
}

function partnerSsoSecret(): string {
  const secret = process.env.PARTNER_SSO_SECRET?.trim();
  if (!secret) {
    throw new RouteError(
      HttpStatusCodes.SERVICE_UNAVAILABLE,
      "Partner portal SSO is not configured on the server"
    );
  }
  return secret;
}

async function ensureTokensTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS partner_sso_tokens (
      token char(64) NOT NULL,
      email varchar(255) NOT NULL,
      expires_at datetime NOT NULL,
      used tinyint(1) NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (token),
      KEY idx_partner_sso_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

type AffiliateLookupResult =
  | { status: "found"; exists: boolean }
  | { status: "wp_unavailable" };

/**
 * Ask WordPress whether an affiliate/partner account exists for this email.
 */
export async function checkAffiliateExists(
  email: string
): Promise<AffiliateLookupResult> {
  const secret = partnerSsoSecret();
  const base = partnerWpApiUrl().replace(/\/$/, "");
  const url = `${base}/affiliate-exists?email=${encodeURIComponent(email)}`;

  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "X-YR-Partner-Secret": secret,
        Accept: "application/json",
      },
    });
  } catch (error) {
    console.error("Partner WP affiliate-exists request failed:", error);
    throw new RouteError(
      HttpStatusCodes.BAD_GATEWAY,
      "Could not reach the partner portal. Please try again later."
    );
  }

  if (response.status === 404) {
    console.warn(
      "Partner WP affiliate-exists returned 404 — plugin likely not installed; using manual login fallback"
    );
    return { status: "wp_unavailable" };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Partner WP affiliate-exists error:", response.status, body);
    throw new RouteError(
      HttpStatusCodes.BAD_GATEWAY,
      "Partner portal lookup failed. Please try again later."
    );
  }

  const data = (await response.json()) as { exists?: boolean };
  return { status: "found", exists: data.exists === true };
}

async function createSsoToken(email: string): Promise<string> {
  await ensureTokensTable();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

  await pool.query<ResultSetHeader>(
    `INSERT INTO partner_sso_tokens (token, email, expires_at, used)
     VALUES (?, ?, ?, 0)`,
    [token, email.toLowerCase().trim(), expiresAt]
  );

  return token;
}

function buildPartnerLoginUrl(token: string): string {
  const base = partnerLoginUrl();
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}yr_sso=${encodeURIComponent(token)}`;
}

/**
 * Phleb app: resolve whether affiliate exists and return SSO URL or signup info.
 */
export async function getPartnerPortalAccess(email: string): Promise<{
  exists: boolean;
  url?: string;
  message?: string;
  signupUrl: string;
  manualLogin?: boolean;
}> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Email is required");
  }

  const signupUrl = partnerSignupUrl();
  const lookup = await checkAffiliateExists(normalized);

  if (lookup.status === "wp_unavailable") {
    return {
      exists: false,
      manualLogin: true,
      url: partnerLoginUrl(),
      signupUrl,
      message:
        "Automatic sign-in is not available yet. Open the partner portal and log in with your affiliate account, or sign up if you do not have one yet.",
    };
  }

  if (!lookup.exists) {
    return {
      exists: false,
      signupUrl,
      message:
        "No affiliate account was found for your app email. You can register as a partner on the website.",
    };
  }

  const token = await createSsoToken(normalized);
  return {
    exists: true,
    url: buildPartnerLoginUrl(token),
    signupUrl,
  };
}

/**
 * WordPress consumes one-time SSO token (server-to-server).
 */
export async function consumeSsoToken(token: string): Promise<string> {
  await ensureTokensTable();
  const trimmed = token.trim();
  if (!trimmed) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Token is required");
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT email, expires_at, used FROM partner_sso_tokens WHERE token = ? LIMIT 1`,
    [trimmed]
  );

  if (rows.length === 0) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Invalid or expired sign-in link");
  }

  const row = rows[0];
  if (row.used) {
    throw new RouteError(HttpStatusCodes.GONE, "Sign-in link already used");
  }

  const expiresAt = new Date(row.expires_at);
  if (expiresAt.getTime() < Date.now()) {
    throw new RouteError(HttpStatusCodes.GONE, "Sign-in link expired");
  }

  await pool.query<ResultSetHeader>(
    `UPDATE partner_sso_tokens SET used = 1 WHERE token = ?`,
    [trimmed]
  );

  return String(row.email);
}

export function verifyPartnerSsoSecret(headerValue: string | undefined): void {
  const expected = partnerSsoSecret();
  if (!headerValue || headerValue !== expected) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Invalid partner SSO secret");
  }
}
