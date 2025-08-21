-- Drop coupon_discount column from orders table
ALTER TABLE `orders` 
DROP COLUMN `coupon_discount`;

-- Verify the column has been dropped
DESCRIBE `orders`;
