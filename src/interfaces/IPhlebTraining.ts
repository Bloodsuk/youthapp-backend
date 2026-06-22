export type PhlebTrainingRecordStatus =
  | "valid"
  | "expiringSoon"
  | "expired"
  | "notStarted";

export type PhlebTrainingOverallStatus =
  | "fullyQualified"
  | "renewalDue"
  | "actionRequired";

export interface IPhlebTrainingOverview {
  overall_status: PhlebTrainingOverallStatus;
  matrix_valid_count: number;
  renewal_due_count: number;
  pending_sign_off_count: number;
  approved_task_count: number;
}

export interface IPhlebTrainingMatrixItem {
  id: number;
  item_name: string;
  status: PhlebTrainingRecordStatus;
  completed_date: string | null;
  next_due_date: string | null;
  mandatory: boolean;
}

export interface IPhlebApprovedTaskRecord {
  id: number;
  task_name: string;
  required_competency: string | null;
  approved: boolean;
}

export interface IPhlebCompetencySignoff {
  id: number;
  item_key: string;
  title: string;
  completed: boolean;
  signed_off_by: string | null;
  signed_off_at: string | null;
}
