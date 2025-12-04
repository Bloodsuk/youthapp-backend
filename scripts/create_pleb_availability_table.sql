-- Create pleb_availability table for flexible availability and service range
-- This table allows multiple time slots per day and stores distance/range information
-- Existing working_hours and travel_radius in phlebotomy_applications are kept for quick onboarding

CREATE TABLE pleb_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pleb_id INT NOT NULL,
  day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
  start_time TIME NOT NULL COMMENT 'Start time for this availability slot (e.g., 09:00:00)',
  end_time TIME NOT NULL COMMENT 'End time for this availability slot (e.g., 12:00:00)',
  is_available TINYINT(1) DEFAULT 1 COMMENT 'Can temporarily disable a slot without deleting it',
  
  -- Service range (stored on each row, same value for all rows of same pleb)
  max_distance_miles DECIMAL(10,2) NOT NULL COMMENT 'Maximum service distance in miles (same for all slots of same pleb)',
  max_distance_km DECIMAL(10,2) GENERATED ALWAYS AS (max_distance_miles * 1.60934) STORED COMMENT 'Auto-calculated distance in kilometers',
  unit ENUM('miles', 'km') DEFAULT 'miles' COMMENT 'Distance unit preference',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (pleb_id) REFERENCES phlebotomy_applications(id) ON DELETE CASCADE,
  
  -- Indexes for performance
  INDEX idx_pleb_id (pleb_id),
  INDEX idx_day_time (day_of_week, start_time, end_time),
  INDEX idx_available (is_available),
  INDEX idx_distance (max_distance_miles),
  INDEX idx_pleb_day (pleb_id, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comments
ALTER TABLE pleb_availability 
  COMMENT = 'Flexible availability schedule for plebs with multiple time slots per day and service range';

