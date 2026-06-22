export type PhlebComplianceDocStatus = "pending_review" | "approved" | "rejected";

export interface IPhlebComplianceSignoff {
  id: number;
  item_key: string;
  title: string;
  completed: boolean;
  signed_off_by: string | null;
  signed_off_at: string | null;
}

export interface IPhlebComplianceDocument {
  id: number;
  file_name: string;
  file_path: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  status: PhlebComplianceDocStatus;
  expiry_date: string | null;
  notes: string | null;
  uploaded_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export type PhlebComplianceItemStatus =
  | "valid"
  | "expiringSoon"
  | "expired"
  | "missing"
  | "pendingReview"
  | "rejected";

export interface IPhlebComplianceItem {
  item_key: string;
  title: string;
  status: PhlebComplianceItemStatus;
  signoff: IPhlebComplianceSignoff;
  current_document: IPhlebComplianceDocument | null;
  can_upload: boolean;
}

export interface IPhlebComplianceOverview {
  overall_status: "green" | "amber" | "red";
  valid_count: number;
  expiring_count: number;
  action_required_count: number;
  pending_review_count: number;
  can_be_assigned_to_jobs: boolean;
}

export interface IPhlebComplianceDocumentReview {
  status: "approved" | "rejected";
  notes?: string;
  signed_off_by?: string;
}
