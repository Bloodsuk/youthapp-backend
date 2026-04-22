ALTER TABLE pleb_availability
  ADD COLUMN specific_date DATE DEFAULT NULL AFTER day_of_week,
  ADD COLUMN notes VARCHAR(255) DEFAULT NULL AFTER unit,
  MODIFY COLUMN day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') DEFAULT NULL,
  ADD INDEX idx_specific_date (pleb_id, specific_date),
  ADD INDEX idx_date_available (specific_date, is_available);
