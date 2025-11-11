-- Insert dummy pleb_jobs data for pleb_id = 414
-- Run this in your MySQL client connected to the YouthApp DB

INSERT INTO pleb_jobs (tracking_number, pleb_id, order_id, job_status, created_at)
VALUES
  ('TRK-414-001', 414, 9001, 'Assigned',        NOW()),
  ('TRK-414-002', 414, 9002, 'Picked Up',       NOW()),
  ('TRK-414-003', 414, 9003, 'In Transit',      NOW()),
  ('TRK-414-004', 414, 9004, 'Delivered',       NOW()),
  ('TRK-414-005', 414, 9005, 'Cancelled',       NOW());


