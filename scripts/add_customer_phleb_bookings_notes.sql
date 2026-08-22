-- Additive: practitioner notes on home-visit bookings.
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_phleb_bookings'
    AND COLUMN_NAME = 'notes'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE customer_phleb_bookings ADD COLUMN notes TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
