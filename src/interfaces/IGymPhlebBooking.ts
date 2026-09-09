export type GymPhlebBookingStatus =
  | "Assigned"
  | "Pickup"
  | "Delivered"
  | "Cancelled";

export interface IGymPhlebBooking {
  id: number;
  gym_post_id: number;
  gym_name: string;
  gym_address: string | null;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  pleb_id: number;
  /** Maps DB `payout_amount` */
  pay_amount: number;
  job_status: GymPhlebBookingStatus;
  is_paid: boolean;
  created_by: string | null;
  created_at: string;
  modified_at: string;
  /** Display helper: "HH:MM - HH:MM" or start only */
  booking_time?: string | null;
}
