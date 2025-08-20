-- Update existing user_coupon_usage table to allow multiple uses per user
-- Remove unique constraint and add regular index

-- Drop the unique constraint if it exists
ALTER TABLE `user_coupon_usage` DROP INDEX `unique_user_coupon`;

-- Add regular index for performance
ALTER TABLE `user_coupon_usage` ADD INDEX `idx_user_coupon` (`user_id`, `coupon_id`);

-- Verify the changes
DESCRIBE `user_coupon_usage`;

