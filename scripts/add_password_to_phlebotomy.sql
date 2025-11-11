-- Add password column to phlebotomy_applications table
ALTER TABLE phlebotomy_applications 
ADD COLUMN password VARCHAR(255) NULL AFTER email;

