CREATE TABLE IF NOT EXISTS bookings_listing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_date DATE NOT NULL,
  booking_time VARCHAR(50) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_booking_date (booking_date),
  KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
