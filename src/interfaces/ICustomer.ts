import { Gender,  YesNo } from "@src/constants/enums";

export interface ICustomer {
  id: number;
  client_code: string;
  fore_name: string;
  sur_name: string;
  date_of_birth: string;
  gender: Gender;
  address: string;
  town: string;
  country: string;
  postal_code: string;
  email: string;
  telephone: string;
  password: string;
  created_by: number;
  created_at: string;
  comments: string;
  current_medication: string;
  username: string;
  user_level: string;
  status: string;
  notifications: YesNo;
  notification_types: string;
}
