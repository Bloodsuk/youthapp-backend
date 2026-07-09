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
  available_days?: string;
  blood_draw_issues?: string;
  blood_draw_issue_types?: string;
  blood_draw_issue_detail?: string;
  customer_postcode?: string;
  created_at?: string;
}

