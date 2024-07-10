export interface ICoupon {
  id: number;
  coupon_id: string;
  value: number;
  type: number;
  expiry_date: string;
  max_users: number;
  used: number;
  created_on: string;
}
