export type SampleReturnStatus =
  | "awaiting_payment"
  | "requested"
  | "created"
  | "posted"
  | "at_lab"
  | "results"
  | "manual_review";

export type SampleReturnStep =
  | "find_order"
  | "awaiting_payment"
  | "package"
  | "return_ready"
  | "manual_review";

export interface ISampleReturnAddress {
  first_name: string;
  last_name: string;
  address_line1: string;
  city: string;
  postcode: string;
  country: string;
  country_iso_code: string;
  /** Single-line label for UI / email. */
  label: string;
}

export interface ISampleReturnRow {
  id: number;
  order_id: number;
  status: SampleReturnStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_pence: number;
  tracking_number: string | null;
  qr_data: string | null;
  created_at: Date | string;
  paid_at: Date | string | null;
  posted_at: Date | string | null;
  received_at: Date | string | null;
}

export interface ISampleReturnSnapshot {
  return_id: number;
  token: string;
  step: SampleReturnStep;
  status: SampleReturnStatus;
  /** False once status is posted / at_lab / results — QR must not be shown or emailed. */
  qr_usable: boolean;
  order_number: string;
  order_id: number;
  customer_email: string;
  tracking_number: string | null;
  qr_data: string | null;
  /**
   * Where the package is sent (QR destination) — fixed Youth Revisited PO Box.
   * Kept as `return_address` for older app builds.
   */
  return_address: ISampleReturnAddress;
  /** Alias of return_address — clearer name for “send to company”. */
  destination_address: ISampleReturnAddress;
  /**
   * If Royal Mail cannot deliver to the lab, package goes back here (customer).
   */
  customer_return_address: ISampleReturnAddress | null;
  fee_label: string;
  amount_pence: number;
  message?: string | null;
}
