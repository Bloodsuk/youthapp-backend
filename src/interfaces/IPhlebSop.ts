export type PhlebSopAckStatus =
  | "acknowledged"
  | "unacknowledged"
  | "reference";

export interface IPhlebSopDocument {
  id: number;
  title: string;
  description: string | null;
  current_version: string;
  file_url: string | null;
  is_active: boolean;
  requires_acknowledgement: boolean;
  document_code: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface IPhlebSopAcknowledgement {
  id: number;
  phleb_id: number;
  sop_id: number;
  version: string;
  signed_by: string | null;
  signed_at: string | null;
}

export interface IPhlebSopForPhleb extends IPhlebSopDocument {
  status: PhlebSopAckStatus;
  acknowledged_version: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  has_document: boolean;
  document_viewed: boolean;
  viewed_at: string | null;
  /** Spec: only required docs show a tick / can be acknowledged. */
  can_acknowledge: boolean;
  reacknowledgement_needed: boolean;
}

export interface IPhlebSopListResult {
  documents: IPhlebSopForPhleb[];
  required_total: number;
  required_opened: number;
  required_acknowledged: number;
  can_acknowledge_all: boolean;
}

export interface IPhlebSopCreateInput {
  title: string;
  description?: string;
  current_version?: string;
  file_url?: string;
  is_active?: boolean;
  requires_acknowledgement?: boolean;
  document_code?: string | null;
}

export interface IPhlebSopUpdateInput {
  title?: string;
  description?: string;
  current_version?: string;
  file_url?: string;
  is_active?: boolean;
  requires_acknowledgement?: boolean;
  document_code?: string | null;
}
