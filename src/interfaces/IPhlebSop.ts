export type PhlebSopAckStatus = "pending" | "acknowledged";

export interface IPhlebSopDocument {
  id: number;
  title: string;
  description: string | null;
  current_version: string;
  file_url: string | null;
  is_active: boolean;
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
}

export interface IPhlebSopCreateInput {
  title: string;
  description?: string;
  current_version?: string;
  file_url?: string;
  is_active?: boolean;
}

export interface IPhlebSopUpdateInput {
  title?: string;
  description?: string;
  current_version?: string;
  file_url?: string;
  is_active?: boolean;
}
