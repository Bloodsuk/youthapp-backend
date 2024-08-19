import { UserLevels } from "@src/constants/enums";

export interface IUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  status: number;
  is_verified: number;
  pay_on_credit: string;
  credit_balance: string;
  created_at: string;
  image: string;
  title: string;
  favicon: string;
  logo: string;
  company_name: string;
  area_of_business: string;
  number_of_clients: string;
  test_per_month: string;
  comments_box: string;
  admin_comments: string;
  enable_credit: number;
  total_credit_balance: string;
  total_credit_limit: string;
  disable_bookig: number;
  practitioner_id: number;
  user_level: UserLevels;
  username: string;
  allow_explanations_reports: string;
  notification_types: string;
  stripe_id: string;
  role_id: string;
}
