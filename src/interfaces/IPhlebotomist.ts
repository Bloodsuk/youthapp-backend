export interface IPhlebotomist {
  id: number;
  full_name: string;
  home_address: string;
  phone: string;
  email: string;
  employment_type: string;
  working_hours: string;
  other_job: string;
  unavailable_times: string;
  drive: string;
  travel_radius: string;
  dbs: string;
  certifications: string;
  experience: string;
  exp_years: string;
  services: string;
  first_aid: string;
  first_aid_desc: string;
  trainer: string;
  trainer_desc: string;
  training_academy: string;
  payment_terms: string;
  extra_info: string;
  lat: string;
  lng: string;
  created_at: string;
  is_active: number;
  is_email_sent: number;
  password?: string; // Added for authentication
}
