import fetch from "node-fetch";

const DEFAULT_GHL_STATUS_UPDATE_URL =
  "https://www.practitioner.youth-revisited.co.uk/home-visit-dashboard/update_job_status.php";

/**
 * Maps app/job DB statuses to dashboard GHL labels (update_job_status.php → ghl-status-notify.php).
 */
function mapJobStatusToGhl(jobStatus: string): string | null {
  const s = jobStatus.trim().toLowerCase().replace(/_/g, " ");
  if (s === "picked up" || s === "in transit" || s === "active") {
    return "Picked Up";
  }
  if (s === "delivered" || s === "completed" || s === "deliver") {
    return "Delivered";
  }
  if (s === "cancelled" || s === "failed visit" || s === "failed") {
    return "Failed Visit";
  }
  return null;
}

function isEnabled(): boolean {
  const flag = (process.env.GHL_STATUS_NOTIFY_ENABLED ?? "1").trim().toLowerCase();
  return flag !== "0" && flag !== "false" && flag !== "off";
}

/**
 * POST order_id + new_status to legacy dashboard PHP (triggers GHL WhatsApp).
 * Non-fatal: logs errors but does not throw.
 */
async function notifyJobStatusChange(
  orderId: number,
  jobStatus: string
): Promise<void> {
  if (!isEnabled()) return;

  const newStatus = mapJobStatusToGhl(jobStatus);
  if (!newStatus || !Number.isFinite(orderId) || orderId <= 0) {
    return;
  }

  const url =
    process.env.GHL_STATUS_UPDATE_URL?.trim() || DEFAULT_GHL_STATUS_UPDATE_URL;

  // Dashboard PHP expects `status`, not `new_status` (see update_job_status.php).
  const body = new URLSearchParams({
    order_id: String(orderId),
    status: newStatus,
  });

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error(
        `[GHL] update_job_status failed (${resp.status}) order=${orderId} status=${newStatus}:`,
        text.slice(0, 300)
      );
      return;
    }

    let payload: { status?: string; message?: string } | null = null;
    try {
      payload = JSON.parse(text) as { status?: string; message?: string };
    } catch {
      payload = null;
    }

    if (payload?.status === "success") {
      console.log(
        `[GHL] update_job_status ok order=${orderId} status=${newStatus}`,
        payload
      );
      return;
    }

    if (payload?.status === "blocked") {
      console.warn(
        `[GHL] update_job_status blocked order=${orderId} status=${newStatus}:`,
        payload.message ?? text.slice(0, 300)
      );
      return;
    }

    console.error(
      `[GHL] update_job_status unexpected response order=${orderId} status=${newStatus}:`,
      text.slice(0, 300)
    );
  } catch (error) {
    console.error(
      `[GHL] update_job_status error order=${orderId}:`,
      error instanceof Error ? error.message : error
    );
  }
}

export default {
  mapJobStatusToGhl,
  notifyJobStatusChange,
} as const;
