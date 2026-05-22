-- Apply on local MySQL (practitionermaindb) for phleb/pleb + live tracking features.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS phlebotomy_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  home_address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255) NOT NULL,
  employment_type VARCHAR(100),
  working_hours VARCHAR(255),
  other_job VARCHAR(50),
  unavailable_times VARCHAR(255),
  drive VARCHAR(10),
  travel_radius VARCHAR(50),
  dbs VARCHAR(10),
  certifications TEXT,
  experience TEXT,
  exp_years VARCHAR(50),
  services TEXT,
  first_aid VARCHAR(10),
  first_aid_desc TEXT,
  trainer VARCHAR(10),
  trainer_desc TEXT,
  training_academy VARCHAR(255),
  payment_terms TEXT,
  extra_info TEXT,
  lat VARCHAR(50),
  lng VARCHAR(50),
  password VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active TINYINT(1) DEFAULT 1,
  is_email_sent TINYINT(1) DEFAULT 0,
  availability_schedule JSON NULL,
  max_distance_miles DECIMAL(10,2) NULL,
  max_distance_km DECIMAL(10,2) NULL,
  distance_unit ENUM('miles', 'km') DEFAULT 'miles',
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pleb_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tracking_number VARCHAR(100) DEFAULT NULL,
  pleb_id INT NOT NULL,
  order_id INT NOT NULL,
  job_status VARCHAR(50) NOT NULL DEFAULT 'Assigned',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pleb_id (pleb_id),
  KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customer_phleb_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  slot_times VARCHAR(255),
  price VARCHAR(50),
  weekend_surcharge VARCHAR(50) DEFAULT '0',
  zone VARCHAR(50),
  shift_type VARCHAR(50),
  availability VARCHAR(255) DEFAULT NULL,
  additional_preferences TEXT DEFAULT NULL,
  client_booking_date DATE DEFAULT NULL,
  client_booking_start_time TIME DEFAULT NULL,
  client_booking_end_time TIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pleb_live_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pleb_id INT NOT NULL,
  job_id INT NOT NULL,
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  customer_lat DECIMAL(10,8) DEFAULT NULL,
  customer_lng DECIMAL(11,8) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_pleb_job (pleb_id, job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
