import crypto from "crypto";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { RouteError } from "@src/other/classes";

const DEFAULT_FORM_URL =
  "https://www.practitioner.youth-revisited.co.uk/application_form";
const TOKEN_TTL_SECONDS = 300;

function applicationFormUrl(): string {
  return (
    process.env.PHLEB_APPLICATION_FORM_URL?.trim() || DEFAULT_FORM_URL
  );
}

function bypassSecret(): string {
  const secret =
    process.env.PHLEB_APPLICATION_FORM_BYPASS_SECRET?.trim() ||
    process.env.PARTNER_SSO_SECRET?.trim();
  if (!secret) {
    throw new RouteError(
      HttpStatusCodes.SERVICE_UNAVAILABLE,
      "Application form bypass is not configured on the server"
    );
  }
  return secret;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Build application form URL with a short-lived signed bypass token
 * so phlebs from the app skip the page password (YRapplication1).
 *
 * Practitioner PHP must validate yr_phleb_id + yr_ts + yr_sig before
 * skipping password protection (see scripts/application-form-bypass.php).
 */
export function getSubmitContractAccess(phlebId: number, email: string): {
  url: string;
} {
  if (!Number.isFinite(phlebId) || phlebId <= 0) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid phlebotomist");
  }

  const secret = bypassSecret();
  const ts = Math.floor(Date.now() / 1000);
  const normalizedEmail = (email || "").trim().toLowerCase();
  const payload = `${phlebId}.${ts}.${normalizedEmail}`;
  const sig = signPayload(payload, secret);

  const base = applicationFormUrl().replace(/\/$/, "");
  const params = new URLSearchParams({
    yr_app: "1",
    yr_phleb_id: String(phlebId),
    yr_ts: String(ts),
    yr_email: normalizedEmail,
    yr_sig: sig,
  });

  return { url: `${base}?${params.toString()}` };
}

export function getTokenTtlSeconds(): number {
  return TOKEN_TTL_SECONDS;
}
