-- Local test accounts (MD5 passwords). Safe to re-run: deletes by email first.

DELETE FROM customers WHERE email IN ('testcustomer@local.test');
DELETE FROM phlebotomy_applications WHERE email IN ('testphleb@local.test');

-- Customer: login with email OR username "testcustomer", password "test123"
INSERT INTO customers (
  id, client_code, fore_name, sur_name, email, telephone,
  created_by, username, password, user_level, status
) VALUES (
  90001,
  'TEST-CUST-001',
  'Test',
  'Customer',
  'testcustomer@local.test',
  '07000000001',
  1,
  'testcustomer',
  'cc03e747a6afbbcbf8be7668acfebee5',
  'Customer',
  1
);

-- Phlebotomist: login with isPleb=true, email testphleb@local.test, password "test123"
INSERT INTO phlebotomy_applications (
  full_name, home_address, phone, email,
  employment_type, working_hours, drive, travel_radius,
  lat, lng, password, is_active, is_email_sent
) VALUES (
  'Test Phleb',
  '1 Test Street, London',
  '07000000002',
  'testphleb@local.test',
  'Full-time',
  '9:00-17:00',
  'Yes',
  '30 miles',
  '51.5074',
  '-0.1278',
  'cc03e747a6afbbcbf8be7668acfebee5',
  1,
  1
);
