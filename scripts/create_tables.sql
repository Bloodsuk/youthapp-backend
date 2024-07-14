CREATE TABLE categories (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL
)
CREATE TABLE `coupons` (
  `id` int(11) NOT NULL,
  `coupon_id` varchar(344) DEFAULT NULL,
  `value` float(10,2) NOT NULL,
  `type` int(44) NOT NULL DEFAULT '1' COMMENT '1 for percent 2 for fixed amount',
  `expiry_date` varchar(344) NOT NULL,
  `max_users` int(44) NOT NULL,
  `used` int(33) NOT NULL DEFAULT '0',
  `created_on` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
)
CREATE TABLE `credit_requests` (
  `id` int(11) NOT NULL,
  `user_id` int(55) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'Pending',
  `credit_amount` float(10,2) NOT NULL,
  `remarks` text,
  `is_order` int(55) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
)
CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `client_code` varchar(255) DEFAULT NULL,
  `fore_name` varchar(255) NOT NULL,
  `sur_name` varchar(255) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('Female','Male') DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `town` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `postal_code` varchar(255) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `telephone` varchar(255) DEFAULT NULL,
  `created_by` int(25) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `comments` text,
  `current_medication` varchar(255) DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `password` text,
  `user_level` text,
  `status` int(11) NOT NULL DEFAULT '1',
  `notifications` enum('Yes','No') DEFAULT 'No',
  `notification_types` varchar(55) DEFAULT ''
)
CREATE TABLE `email_configuration` (
  `id` int(11) NOT NULL,
  `smtp_host` varchar(100) NOT NULL,
  `smtp_port` varchar(100) NOT NULL,
  `smtp_username` varchar(100) NOT NULL,
  `smtp_password` varchar(100) NOT NULL,
  `smtp_encryption` varchar(100) NOT NULL
)
CREATE TABLE `email_templates` (
  `id` int(11) NOT NULL COMMENT 'Template Id',
  `type` int(11) NOT NULL COMMENT 'Email Type',
  `subject` varchar(255) NOT NULL COMMENT 'Email Subject',
  `title` varchar(255) NOT NULL COMMENT 'Email Title',
  `content` text NOT NULL COMMENT 'Email Content',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
CREATE TABLE `employee` (
  `id` int(11) NOT NULL COMMENT 'primary key',
  `employee_name` varchar(255) NOT NULL COMMENT 'employee name',
  `employee_salary` double NOT NULL COMMENT 'employee salary',
  `employee_age` int(11) NOT NULL COMMENT 'employee age'
)
CREATE TABLE `masterlogin` (
  `id` int(11) NOT NULL,
  `masterpass` varchar(255) NOT NULL,
  `user_level` varchar(100) NOT NULL
)
CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `order_id` varchar(255) DEFAULT NULL,
  `transaction_id` varchar(255) NOT NULL,
  `customer_id` int(25) DEFAULT NULL,
  `test_ids` varchar(255) DEFAULT NULL,
  `client_id` varchar(255) DEFAULT NULL,
  `client_name` varchar(255) DEFAULT NULL,
  `subtotal` varchar(255) DEFAULT NULL,
  `discount` varchar(255) DEFAULT NULL,
  `shipping_charges` varchar(255) DEFAULT NULL,
  `other_charges_total` varchar(255) DEFAULT NULL,
  `total_val` float(10,4) NOT NULL,
  `shipping_type` varchar(255) DEFAULT NULL,
  `other_charges` varchar(255) DEFAULT NULL,
  `checkout_type` varchar(255) NOT NULL DEFAULT 'stripe',
  `status` varchar(255) NOT NULL DEFAULT 'Started',
  `payment_status` varchar(255) NOT NULL DEFAULT 'Paid',
  `order_placed_by` int(11) NOT NULL,
  `attachment` varchar(255) DEFAULT NULL,
  `basic_explain` varchar(255) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `practitioner_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved` int(55) NOT NULL DEFAULT '1',
  `current_medication` varchar(255) DEFAULT NULL,
  `last_trained` varchar(50) DEFAULT NULL,
  `fasted` varchar(5) DEFAULT NULL,
  `hydrated` varchar(5) DEFAULT NULL,
  `drank_alcohol` varchar(50) DEFAULT NULL,
  `drugs_taken` varchar(255) DEFAULT NULL,
  `enhancing_drugs` varchar(255) DEFAULT NULL,
  `api_royal` set('no','yes') CHARACTER SET utf8 DEFAULT NULL,
  `royal_id` int(255) DEFAULT NULL,
  `trackingNumber` varchar(1240) DEFAULT NULL,
  `supplements` varchar(255) DEFAULT NULL
)
CREATE TABLE `order_logs` (
  `id` int(11) NOT NULL,
  `order_id` int(25) NOT NULL,
  `status` varchar(255) NOT NULL,
  `date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE `other_charges` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` float(10,2) NOT NULL,
  `abbreviate` varchar(80) DEFAULT NULL
);
CREATE TABLE `product_category` (
  `id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL
);
CREATE TABLE `shiping_types` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` float(10,2) NOT NULL,
  `abbreviate` varchar(80) DEFAULT NULL
);
CREATE TABLE `statuses` (
  `id` int(11) NOT NULL,
  `status_name` varchar(255) NOT NULL,
  `color_code` varchar(255) NOT NULL,
  `sort_num` int(25) NOT NULL
);
CREATE TABLE `tests` (
  `id` int(11) NOT NULL,
  `test_name` varchar(255) NOT NULL,
  `cate_id` varchar(55) DEFAULT NULL,
  `product_model` varchar(50) NOT NULL,
  `test_sku` varchar(50) NOT NULL,
  `test_biomarker` varchar(255) NOT NULL,
  `product_description` text CHARACTER SET utf8 NOT NULL,
  `description` text NOT NULL,
  `procedure` text NOT NULL,
  `side_effects` text NOT NULL,
  `price` varchar(255) NOT NULL,
  `is_featured` enum('Yes','No') NOT NULL DEFAULT 'No',
  `product_unit` enum('in_pcs','in_gm','in_ml','in_nos','In_Vairaint') NOT NULL DEFAULT 'in_gm',
  `weights` varchar(255) NOT NULL,
  `brand_id` int(11) NOT NULL,
  `sort_id` int(11) NOT NULL,
  `status` enum('Active','Inactive') NOT NULL,
  `template_type` enum('default','custom','new_custom') NOT NULL DEFAULT 'default',
  `meta_title` varchar(1024) NOT NULL,
  `meta_keyword` varchar(1024) NOT NULL,
  `meta_description` varchar(1024) NOT NULL,
  `added_on` varchar(50) NOT NULL,
  `last_updatedon` varchar(50) NOT NULL,
  `added_by` int(11) NOT NULL,
  `image_url` varchar(255) NOT NULL,
  `image_banner` varchar(255) NOT NULL,
  `banner_link` varchar(255) NOT NULL,
  `prd_type` varchar(100) NOT NULL,
  `is_reorder` enum('yes','no') NOT NULL DEFAULT 'yes',
  `product_code` varchar(25) DEFAULT NULL,
  `add_on_products` varchar(255) NOT NULL DEFAULT '0',
  `is_addon` varchar(255) NOT NULL DEFAULT 'no',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `practitioner_id` int(11) DEFAULT NULL
);
CREATE TABLE `transactions` (
  `id` int(11) NOT NULL COMMENT 'unique id',
  `response` text NOT NULL COMMENT 'response from stripe',
  `status` int(11) NOT NULL COMMENT '1 = Success, 0 = Fail',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `order_id` int(11) DEFAULT NULL,
  `billing_address` text COMMENT 'Billing address JSON',
  `shipping_address` text COMMENT 'Shipping address JSON'
);

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `address` text,
  `password` varchar(255) DEFAULT NULL,
  `status` int(25) DEFAULT NULL,
  `is_verified` int(25) DEFAULT NULL,
  `pay_on_credit` enum('Yes','No') DEFAULT 'No',
  `credit_balance` float(10,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `image` varchar(255),
  `title` varchar(255) DEFAULT 'Practitioner',
  `favicon` varchar(255),
  `logo` varchar(255),
  `company_name` varchar(255) DEFAULT NULL,
  `area_of_business` varchar(255) DEFAULT NULL,
  `number_of_clients` varchar(255) DEFAULT NULL,
  `test_per_month` varchar(255) DEFAULT NULL,
  `comments_box` varchar(255) DEFAULT NULL,
  `admin_comments` varchar(255) DEFAULT NULL,
  `enable_credit` int(25) NOT NULL DEFAULT '0',
  `total_credit_balance` varchar(55) DEFAULT NULL,
  `total_credit_limit` varchar(55) DEFAULT NULL,
  `disable_bookig` int(22) NOT NULL DEFAULT '0',
  `practitioner_id` int(11) DEFAULT NULL,
  `user_level` enum('Practitioner','Moderator','Admin') DEFAULT 'Practitioner',
  `username` varchar(55) NOT NULL,
  `allow_explanations_reports` enum('Yes','No') DEFAULT 'No',
  `notification_types` varchar(55) DEFAULT '',
  `stripe_id` varchar(255) DEFAULT ''
);

CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sent_from INT NOT NULL,
    sent_to INT NOT NULL,
    sent_from_role varchar(20) NOT NULL,
    sent_to_role varchar(20) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name varchar(20) NOT NULL,
    created_by INT NOT NULL,
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);




