-- Simple version: Add availability and service range columns to phlebotomy_applications table
-- Run this if you're sure the columns don't exist yet
-- If columns already exist, you'll get an error - that's okay, just means migration already ran

ALTER TABLE phlebotomy_applications 
ADD COLUMN availability_schedule JSON NULL COMMENT 'Weekly availability schedule: {"Monday":{"start":"09:00","end":"17:00","available":true},...}' AFTER unavailable_times,
ADD COLUMN max_distance_miles DECIMAL(10,2) NULL COMMENT 'Maximum service distance in miles' AFTER availability_schedule,
ADD COLUMN max_distance_km DECIMAL(10,2) GENERATED ALWAYS AS (CASE WHEN max_distance_miles IS NOT NULL THEN max_distance_miles * 1.60934 ELSE NULL END) STORED COMMENT 'Auto-calculated distance in kilometers' AFTER max_distance_miles,
ADD COLUMN distance_unit ENUM('miles', 'km') DEFAULT 'miles' COMMENT 'Distance unit preference' AFTER max_distance_km;

-- Add index for distance filtering (useful for finding plebs within range)
ALTER TABLE phlebotomy_applications 
ADD INDEX idx_max_distance (max_distance_miles);

-- Migration complete
SELECT 'Migration completed successfully!';


