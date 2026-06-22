export interface IPhlebKitType {
  id: number;
  kit_name: string;
  service_type_id: number | null;
  default_per_job: number;
  low_stock_threshold: number;
  is_active: number;
  created_at?: string;
}

export type PhlebKitRequestPriority = "Normal" | "Urgent";

export interface IPhlebKitRequest {
  id: number;
  phleb_id: number;
  kit_type_id: number;
  kit_name: string;
  quantity_requested: number;
  priority: PhlebKitRequestPriority;
  request_note: string | null;
  status: "Pending" | "Dispatched" | "Cancelled";
  dispatched_qty: number | null;
  dispatch_date: string | null;
  courier_ref: string | null;
  dispatched_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IPhlebKitRequestCreate {
  kit_type_id: number;
  quantity_requested: number;
  priority?: PhlebKitRequestPriority;
  request_note?: string;
}

export interface IPhlebKitBalance {
  kit_type_id: number;
  kit_name: string;
  current_balance: number;
  low_stock_threshold: number;
}

export interface IPhlebKitSummary {
  last_kit_received_date: string | null;
  total_kits_used_this_month: number;
  total_jobs_completed_this_month: number;
  expected_remaining_stock: number;
}

export interface IPhlebKitOverview {
  balances: IPhlebKitBalance[];
  summary: IPhlebKitSummary;
}
