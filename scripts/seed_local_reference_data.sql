-- Reference rows used across the app (shipping, statuses, admin, email stub).

INSERT IGNORE INTO shiping_types (id, name, value, abbreviate) VALUES
(1, 'Standard Delivery', 5.00, 'STD'),
(2, 'Express', 12.50, 'EXP'),
(3, 'Home Visit', 25.00, 'HV');

INSERT IGNORE INTO statuses (id, status_name, color_code, sort_num) VALUES
(1, 'Started', '#FFA500', 1),
(2, 'In Progress', '#2196F3', 2),
(3, 'Received at Lab', '#9C27B0', 3),
(4, 'Results Published', '#4CAF50', 4),
(5, 'Completed', '#4CAF50', 5),
(6, 'Failed', '#F44336', 6),
(7, 'Cancelled', '#9E9E9E', 7);

-- Admin practitioner (created_by for orders)
INSERT IGNORE INTO users (
  id, first_name, last_name, email, username, phone, password,
  status, is_verified, user_level, company_name
) VALUES (
  1, 'Local', 'Admin', 'admin@local.test', 'admin', '07000000000',
  '0192023a7bbd73250516f069df18b500',
  1, 1, 'Admin', 'Local Test Clinic'
);

INSERT IGNORE INTO masterlogin (id, masterpass, user_level) VALUES
(1, '0192023a7bbd73250516f069df18b500', 'Practitioner');

-- Use port 0 in local seed so nodemailer fails fast without hanging (MailService swallows errors).
INSERT IGNORE INTO email_configuration (
  id, smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption
) VALUES (
  1, '127.0.0.1', '0', 'local', 'local', 'none'
);

INSERT IGNORE INTO email_templates (id, type, subject, title, content) VALUES
(1, 1, 'Test', 'Test', 'Test template');

INSERT IGNORE INTO roles (id, role_name, created_by, is_active) VALUES
(1, 'Admin', 1, 1);

INSERT IGNORE INTO permissions (id, permission_name, is_active) VALUES
(1, 'all', 1);

INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
(1, 1, 1);

-- London zone codes for phleb slot pricing (optional)
CREATE TABLE IF NOT EXISTS zone_london (
  id INT AUTO_INCREMENT PRIMARY KEY,
  london_codes VARCHAR(20) NOT NULL,
  KEY idx_code (london_codes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS zone_others (
  id INT AUTO_INCREMENT PRIMARY KEY,
  other_codes VARCHAR(20) NOT NULL,
  KEY idx_code (other_codes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO zone_london (london_codes) VALUES ('SW1'), ('EC1'), ('W1'), ('N1'), ('SE1');
INSERT IGNORE INTO zone_others (other_codes) VALUES ('M1'), ('B1'), ('LS1');
