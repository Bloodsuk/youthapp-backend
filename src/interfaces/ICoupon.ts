export interface ICoupon {
  id: number;
  coupon_id: string;
  value: number;
  type: number;
  expiry_date: string;
  max_users: number;
  used: number;
  apply_on: string;
  created_on: string;
}

export interface IUserCouponUsage {
  id: number;
  user_id: number;
  coupon_id: string;
  used_at: string;
}
