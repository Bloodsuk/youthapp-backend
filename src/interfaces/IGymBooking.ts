export interface IGymBooking {
  order_id: number;
  order_status: string;
  clinic_id: number;
  clinic_name: string;
  booking_date: string;
  booking_time: string;
  booking_day: string;
}

export interface IGymBookingWithOrder extends IGymBooking {
  app_order_id: number;
  app_order_code: string;
  id_on_wp: number;
}
