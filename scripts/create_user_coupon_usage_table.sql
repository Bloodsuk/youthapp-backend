-- Create table to track user coupon usage
CREATE TABLE `user_coupon_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `coupon_id` varchar(344) NOT NULL,
  `used_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_coupon` (`user_id`, `coupon_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_coupon_id` (`coupon_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
