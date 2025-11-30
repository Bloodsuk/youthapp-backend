export interface IPaymentToken {
  id: number;
  user_id: number;
  provider: string;
  token: string;
  fingerprint?: string | null;
  brand?: string | null;
  last4?: string | null;
  exp_month?: string | null;
  exp_year?: string | null;
  created_at?: string;
  updated_at?: string;
}

