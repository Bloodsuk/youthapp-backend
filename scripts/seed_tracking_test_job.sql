-- Test order for customer 90001 + job assigned to phleb 1 (tracking E2E).

UPDATE customers SET
  fore_name = 'Test',
  sur_name = 'Customer',
  address = '10 Downing Street',
  town = 'London',
  country = 'UK',
  postal_code = 'SW1A 2AA',
  telephone = '07000000001'
WHERE id = 90001;

DELETE FROM pleb_live_locations WHERE pleb_id = 1;
DELETE FROM pleb_jobs WHERE pleb_id = 1 OR order_id = 90001;

UPDATE orders SET
  order_id = 'ORD-TRACK-90001',
  transaction_id = 'txn_track_90001',
  customer_id = 90001,
  test_ids = '1',
  client_name = 'Test Customer',
  subtotal = '75.00',
  total_val = 75.00,
  shipping_type = '1',
  checkout_type = 'stripe',
  status = 'In Progress',
  payment_status = 'Paid',
  order_placed_by = 90001,
  created_by = 90001,
  approved = 1,
  is_job_assigned = 0
WHERE id = 90001;

INSERT INTO orders (
  id, order_id, transaction_id, customer_id, test_ids,
  client_name, subtotal, total_val, shipping_type,
  checkout_type, status, payment_status, order_placed_by,
  created_by, approved, is_job_assigned
)
SELECT
  90001, 'ORD-TRACK-90001', 'txn_track_90001', 90001, '1',
  'Test Customer', '75.00', 75.00, '1', 'stripe', 'In Progress', 'Paid',
  90001, 90001, 1, 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE id = 90001);

DELETE FROM customer_phleb_bookings WHERE order_id = 90001;

INSERT INTO customer_phleb_bookings (
  order_id, slot_times, price, weekend_surcharge, zone, shift_type,
  client_booking_date, client_booking_start_time, client_booking_end_time
) VALUES (
  90001,
  '09:00 - 11:00',
  '75.00',
  '0',
  'London',
  'Morning',
  CURDATE(),
  '09:00:00',
  '11:00:00'
);

INSERT INTO pleb_jobs (tracking_number, pleb_id, order_id, job_status, created_at)
VALUES ('TRK-90001-TEST', 1, 90001, 'Assigned', NOW());

UPDATE orders SET is_job_assigned = 1 WHERE id = 90001;

INSERT INTO bookings_listing (booking_date, booking_time, order_id, user_id)
VALUES (CURDATE(), '09:00 - 11:00', 'ORD-TRACK-90001', 90001);
