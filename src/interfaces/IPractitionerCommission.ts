import { ICustomer } from "./ICustomer";

export interface IPractitionerCommission {
  id: number;
  order_id: string;
  commission_amount: string;
  is_paid: string ;
  practitioner_id: number;
  practitioner_first_name: string;
  practitioner_last_name: string;
  practitioner_email: string;
  created_at: string;
}