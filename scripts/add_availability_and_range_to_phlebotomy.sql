-- Add availability and service range columns to phlebotomy_applications table
-- This migration adds structured availability schedule and distance range support

-- Check if columns already exist before adding (prevents errors on re-run)
SET @dbname = DATABASE();
SET @tablename = "phlebotomy_applications";
SET @columnname1 = "availability_schedule";
SET @columnname2 = "max_distance_miles";
SET @columnname3 = "max_distance_km";
SET @columnname4 = "distance_unit";

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname1)
  ) > 0,
  "SELECT 'Column availability_schedule already exists.'",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname1, " JSON NULL COMMENT 'Weekly availability schedule: {\"Monday\":{\"start\":\"09:00\",\"end\":\"17:00\",\"available\":true},...}' AFTER unavailable_times;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname2)
  ) > 0,
  "SELECT 'Column max_distance_miles already exists.'",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname2, " DECIMAL(10,2) NULL COMMENT 'Maximum service distance in miles' AFTER availability_schedule;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname3)
  ) > 0,
  "SELECT 'Column max_distance_km already exists.'",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname3, " DECIMAL(10,2) GENERATED ALWAYS AS (CASE WHEN max_distance_miles IS NOT NULL THEN max_distance_miles * 1.60934 ELSE NULL END) STORED COMMENT 'Auto-calculated distance in kilometers' AFTER max_distance_miles;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname4)
  ) > 0,
  "SELECT 'Column distance_unit already exists.'",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname4, " ENUM('miles', 'km') DEFAULT 'miles' COMMENT 'Distance unit preference' AFTER max_distance_km;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index for distance filtering (useful for finding plebs within range)
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = 'idx_max_distance')
  ) > 0,
  "SELECT 'Index idx_max_distance already exists.'",
  CONCAT("ALTER TABLE ", @tablename, " ADD INDEX idx_max_distance (max_distance_miles);")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Migration complete
SELECT 'Migration completed successfully. Columns availability_schedule, max_distance_miles, max_distance_km, and distance_unit added to phlebotomy_applications table.';


