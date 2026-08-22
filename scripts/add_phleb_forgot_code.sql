-- Additive: enable forgot-password OTP for phlebotomists.
-- Safe to re-run on MySQL/MariaDB.
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'phlebotomy_applications'
    AND COLUMN_NAME = 'forgot_code'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE phlebotomy_applications ADD COLUMN forgot_code VARCHAR(4) DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
