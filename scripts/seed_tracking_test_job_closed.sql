-- Closed test order (90003) — Delivered job for read-only chat testing.
-- Customer 90001 (testcustomer@local.test) · Phleb 1 (testphleb@local.test)

DELETE FROM visit_chat_messages WHERE order_id = 90003;
DELETE FROM pleb_live_locations WHERE pleb_id = 1 AND job_id IN (
  SELECT id FROM pleb_jobs WHERE order_id = 90003
);
DELETE FROM pleb_jobs WHERE order_id = 90003;
DELETE FROM customer_phleb_bookings WHERE order_id = 90003;
DELETE FROM bookings_listing WHERE order_id = 'ORD-TRACK-90003';

INSERT INTO orders (
  id, order_id, transaction_id, customer_id, test_ids,
  client_name, subtotal, total_val, shipping_type,
  checkout_type, status, payment_status, order_placed_by,
  created_by, approved, is_job_assigned
)
SELECT
  90003, 'ORD-TRACK-90003', 'txn_track_90003', 90001, '1',
  'Test Customer', '85.00', 85.00, '1', 'stripe', 'Completed', 'Paid',
  90001, 90001, 1, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE id = 90003);

UPDATE orders SET
  order_id = 'ORD-TRACK-90003',
  transaction_id = 'txn_track_90003',
  customer_id = 90001,
  test_ids = '1',
  client_name = 'Test Customer',
  subtotal = '85.00',
  total_val = 85.00,
  shipping_type = '1',
  checkout_type = 'stripe',
  status = 'Completed',
  payment_status = 'Paid',
  order_placed_by = 90001,
  created_by = 90001,
  approved = 1,
  is_job_assigned = 1
WHERE id = 90003;

INSERT INTO customer_phleb_bookings (
  order_id, slot_times, price, weekend_surcharge, zone, shift_type,
  client_booking_date, client_booking_start_time, client_booking_end_time
) VALUES (
  90003,
  '10:00 - 12:00',
  '85.00',
  '0',
  'London',
  'Morning',
  DATE_SUB(CURDATE(), INTERVAL 2 DAY),
  '10:00:00',
  '12:00:00'
);

INSERT INTO pleb_jobs (tracking_number, pleb_id, order_id, job_status, created_at)
VALUES ('TRK-90003-CLOSED', 1, 90003, 'Delivered', DATE_SUB(NOW(), INTERVAL 1 DAY));

INSERT INTO bookings_listing (booking_date, booking_time, order_id, user_id)
VALUES (DATE_SUB(CURDATE(), INTERVAL 2 DAY), '10:00 - 12:00', 'ORD-TRACK-90003', 90001);

-- Sample chat history (read-only once job is closed)
INSERT INTO visit_chat_messages (
  order_id, job_id, sent_from, sent_from_role, sent_to, sent_to_role,
  message, is_read, created_at
)
SELECT
  90003,
  pj.id,
  90001,
  'c',
  1,
  'ph',
  'Hi, are you on your way?',
  1,
  DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM pleb_jobs pj
WHERE pj.order_id = 90003
LIMIT 1;

INSERT INTO visit_chat_messages (
  order_id, job_id, sent_from, sent_from_role, sent_to, sent_to_role,
  message, is_read, created_at
)
SELECT
  90003,
  pj.id,
  1,
  'ph',
  90001,
  'c',
  'Yes, arriving in 10 minutes.',
  1,
  DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 5 MINUTE
FROM pleb_jobs pj
WHERE pj.order_id = 90003
LIMIT 1;

INSERT INTO visit_chat_messages (
  order_id, job_id, sent_from, sent_from_role, sent_to, sent_to_role,
  message, is_read, created_at
)
SELECT
  90003,
  pj.id,
  90001,
  'c',
  1,
  'ph',
  'Thanks, see you soon.',
  1,
  DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 8 MINUTE
FROM pleb_jobs pj
WHERE pj.order_id = 90003
LIMIT 1;

INSERT INTO visit_chat_messages (
  order_id, job_id, sent_from, sent_from_role, sent_to, sent_to_role,
  message, is_read, created_at
)
SELECT
  90003,
  pj.id,
  1,
  'ph',
  90001,
  'c',
  'Visit complete — samples collected.',
  1,
  DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM pleb_jobs pj
WHERE pj.order_id = 90003
LIMIT 1;
