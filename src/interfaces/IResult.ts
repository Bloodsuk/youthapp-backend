export interface IResult {
  id: number;
  order_id: string;
  transaction_id: string;
  customer_id: number;
  test_ids: string;
  client_id: string;
  client_name: string;
  subtotal: string;
  discount: string;
  shipping_charges: string;
  other_charges_total: string;
  total_val: number;
  shipping_type: string;
  other_charges: string;
  checkout_type: string;
  status: string;
  payment_status: string;
  order_placed_by: number;
  attachment: string | null;
  basic_explain: string | null;
  created_by: number;
  practitioner_id: number;
  created_at: string;
  approved: number;
  current_medication: string;
  last_trained: string;
  fasted: string;
  hydrated: string;
  drank_alcohol: string;
  health_issue: string;
  having_test: string;
  drugs_taken: string;
  enhancing_drugs: string;
  api_royal: string;
  royal_id: string | null;
  trackingNumber: string | null;
  supplements: string;
  practitioner_name: string;
  date_of_birth: string;
  tests: string;
}
