import { ICustomer } from "./ICustomer";
import { IPhlebBooking } from "./IPhlebBooking";

export interface IOrder {
  id: number;
  order_id: string ;
  transaction_id: string;
  customer_id: number;
  test_ids: string ;
  client_id: string ;
  client_name: string ;
  subtotal: string ;
  discount: string ;
  shipping_charges: string ;
  other_charges_total: string ;
  total_val: number;
  shipping_type: string ;
  other_charges: string ;
  checkout_type: string;
  status: string;
  payment_status: string;
  order_placed_by: number;
  attachment: string ;
  basic_explain: string ;
  created_by: number;
  practitioner_id: number;
  created_at: string;
  approved: number;
  current_medication: string;
  last_trained: string;
  fasted: string ;
  hydrated: string ;
  drank_alcohol: string ;
  drugs_taken: string ;
  enhancing_drugs: string ;
  api_royal: string ;
  royal_id: number ;
  trackingNumber: string ;
  supplements: string ;
  /** Populated when order is loaded with customer join (list APIs). */
  customer?: ICustomer;
  /** From JOIN customers: customer email (list APIs). */
  customer_email?: string;
  customer_fore_name?: string;
  customer_sur_name?: string;
  customer_date_of_birth?: string;
  /** From JOIN users (practitioner). */
  practitioner_first_name?: string;
  practitioner_last_name?: string;
  practitioner_email?: string;
  phleb_booking?: IPhlebBooking;
}