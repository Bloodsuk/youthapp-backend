-- Add coupon_discount column to orders table
ALTER TABLE `orders` 
ADD COLUMN `coupon_discount` DECIMAL(10,2) DEFAULT 0.00 AFTER `discount`;

-- Add comment to explain the field
ALTER TABLE `orders` 
MODIFY COLUMN `coupon_discount` DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Coupon discount amount applied to the order';
