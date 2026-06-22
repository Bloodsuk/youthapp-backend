export interface IPhlebPerformanceSummary {
  jobs_this_month: number;
  delivered_this_month: number;
  active_jobs: number;
  cancelled_this_month: number;
  completion_rate: number | null;
  on_time_rate: number | null;
  total_delivered_all_time: number;
}

export interface IPhlebPerformanceRecentJob {
  job_id: number;
  order_id: number;
  job_status: string;
  completed_at: string | null;
  booking_date: string | null;
  title: string;
  subtitle: string;
  on_time: boolean | null;
}

export interface IPhlebPerformanceOverview {
  summary: IPhlebPerformanceSummary;
  recent_jobs: IPhlebPerformanceRecentJob[];
  has_feedback: boolean;
}
