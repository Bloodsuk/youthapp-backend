export type EventBookingStatus =
  | "Assigned"
  | "Pickup"
  | "Delivered"
  | "Cancelled";

export interface IEventBooking {
  id: number;
  event_name: string;
  event_address: string | null;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  pleb_id: number;
  pay_amount: number;
  job_status: EventBookingStatus;
  is_paid: boolean;
  created_by: string | null;
  created_at: string;
  modified_at: string;
  /** Display helper: "HH:MM - HH:MM" or start only */
  booking_time?: string | null;
}
