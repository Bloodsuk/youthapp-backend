-- Second test order (90002) for customer 90001, assigned to phleb 1 (same as 90001).

DELETE FROM pleb_live_locations WHERE pleb_id = 1 AND job_id IN (
  SELECT id FROM pleb_jobs WHERE order_id = 90002
);
DELETE FROM pleb_jobs WHERE order_id = 90002;
DELETE FROM customer_phleb_bookings WHERE order_id = 90002;
DELETE FROM bookings_listing WHERE order_id = 'ORD-TRACK-90002';

INSERT INTO orders (
  id, order_id, transaction_id, customer_id, test_ids,
  client_name, subtotal, total_val, shipping_type,
  checkout_type, status, payment_status, order_placed_by,
  created_by, approved, is_job_assigned
)
SELECT
  90002, 'ORD-TRACK-90002', 'txn_track_90002', 90001, '1',
  'Test Customer', '85.00', 85.00, '1', 'stripe', 'In Progress', 'Paid',
  90001, 90001, 1, 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE id = 90002);

UPDATE orders SET
  order_id = 'ORD-TRACK-90002',
  transaction_id = 'txn_track_90002',
  customer_id = 90001,
  test_ids = '1',
  client_name = 'Test Customer',
  subtotal = '85.00',
  total_val = 85.00,
  shipping_type = '1',
  checkout_type = 'stripe',
  status = 'In Progress',
  payment_status = 'Paid',
  order_placed_by = 90001,
  created_by = 90001,
  approved = 1,
  is_job_assigned = 1
WHERE id = 90002;

INSERT INTO customer_phleb_bookings (
  order_id, slot_times, price, weekend_surcharge, zone, shift_type,
  client_booking_date, client_booking_start_time, client_booking_end_time
) VALUES (
  90002,
  '14:00 - 16:00',
  '85.00',
  '0',
  'London',
  'Afternoon',
  CURDATE(),
  '14:00:00',
  '16:00:00'
);

INSERT INTO pleb_jobs (tracking_number, pleb_id, order_id, job_status, created_at)
VALUES ('TRK-90002-TEST', 1, 90002, 'Assigned', NOW());

INSERT INTO bookings_listing (booking_date, booking_time, order_id, user_id)
VALUES (CURDATE(), '14:00 - 16:00', 'ORD-TRACK-90002', 90001);
