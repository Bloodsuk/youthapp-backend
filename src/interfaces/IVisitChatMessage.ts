export interface IVisitChatMessage {
  id: number;
  order_id: number;
  job_id: number | null;
  sent_from: number;
  sent_from_role: string;
  sent_to: number;
  sent_to_role: string;
  message: string;
  is_read: boolean;
  created_at: string;
  display_name: string;
}

export interface IVisitChatThreadMeta {
  order_id: number;
  job_id: number | null;
  customer_id: number | null;
  pleb_id: number | null;
  counterpart_name: string;
  unread_count: number;
  job_status: string | null;
  can_send: boolean;
}

export interface IVisitChatUnreadSummaryItem {
  order_id: number;
  job_id: number | null;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}
