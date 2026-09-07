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
  order_number: string;
  order_id: number;
  customer_email: string;
  tracking_number: string | null;
  qr_data: string | null;
  fee_label: string;
  amount_pence: number;
  message?: string | null;
}
