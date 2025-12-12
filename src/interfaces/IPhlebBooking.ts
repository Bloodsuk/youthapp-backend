export interface IPhlebBooking {
  id?: number;
  slot_times: string;
  price: string;
  weekend_surcharge: string;
  zone: string;
  shift_type: string;
  order_id?: number;
  availability?: string;
  additional_preferences?: string;
  created_at?: string;
}

