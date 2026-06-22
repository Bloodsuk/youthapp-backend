export interface IPhlebProfile {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  home_address: string;
  city: string;
  home_postcode: string | null;
  user_level: "Phlebotomist";
}

export interface IPhlebProfileUpdate {
  full_name: string;
  email: string;
  phone: string;
  home_address: string;
  city?: string;
  home_postcode?: string;
  password?: string;
}
