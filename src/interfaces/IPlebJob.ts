export interface IPlebJob {
  id: number;
  tracking_number: string;
  pleb_id: number;
  order_id: number;
  job_status: string;
  created_at: string;
  /** customers.fore_name — set when fetching jobs for a phlebotomist dashboard */
  customer_fore_name?: string | null;
  /** customers.address, town, postal_code (no country) */
  customer_full_address?: string | null;
  /** customer_phleb_bookings.client_booking_date */
  client_booking_date?: string | null;
  client_booking_start_time?: string | null;
  client_booking_end_time?: string | null;
  /** Display range: start - end when both exist */
  booking_time?: string | null;
}


