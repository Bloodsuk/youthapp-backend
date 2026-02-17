-- Tables required by TestsService for /api/tests/all and related endpoints
-- Run: mysql -u your_user -p practappstaging < scripts/add_tests_related_tables.sql

-- 1. tests_cost_by_practitioner: per-practitioner custom customer cost for tests
CREATE TABLE IF NOT EXISTS tests_cost_by_practitioner (
  practitioner_id INT NOT NULL,
  tests_id INT NOT NULL,
  customer_cost DECIMAL(10,2) DEFAULT NULL,
  PRIMARY KEY (practitioner_id, tests_id),
  KEY idx_tests_id (tests_id),
  KEY idx_practitioner_id (practitioner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. tests_active_deactive: which tests are active per practitioner/clinic
CREATE TABLE IF NOT EXISTS tests_active_deactive (
  is_active_for_clinic TINYINT(1) DEFAULT 1,
  test_id INT NOT NULL,
  practitioner_id INT NOT NULL,
  PRIMARY KEY (test_id, practitioner_id),
  KEY idx_practitioner_id (practitioner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. practitioner_test_price: practitioner-specific prices for tests
CREATE TABLE IF NOT EXISTS practitioner_test_price (
  id INT AUTO_INCREMENT PRIMARY KEY,
  practitioner_id INT NOT NULL,
  test_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  KEY idx_test_id (test_id),
  KEY idx_practitioner_id (practitioner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed data: link practitioner_id 1 (Admin) to existing tests with default costs
-- Only insert if tests exist (practitioner 1 = systemtest18 from seed)
INSERT IGNORE INTO tests_cost_by_practitioner (practitioner_id, tests_id, customer_cost)
SELECT 1, id, CAST(price AS DECIMAL(10,2))
FROM tests
WHERE id IS NOT NULL
LIMIT 50;

-- Seed practitioner_test_price for practitioner 1
INSERT IGNORE INTO practitioner_test_price (practitioner_id, test_id, price)
SELECT 1, id, CAST(price AS DECIMAL(10,2))
FROM tests
WHERE id IS NOT NULL
LIMIT 50;

-- Seed categories - used by /api/categories/all
INSERT IGNORE INTO categories (id, name) VALUES
(1, 'Wellness'),
(2, 'Nutrition'),
(3, 'Male Hormone'),
(4, 'Female Hormone'),
(5, 'Add On Tests'),
(6, 'Sports Performance');

-- Seed services (other_charges) - used by /api/services/all
INSERT IGNORE INTO other_charges (id, name, value, abbreviate) VALUES
(1, 'Blood Draw', 12.50, 'BD'),
(2, 'Clinic Fee', 0, 'CF'),
(3, 'Grimsby Clinic Fee', 40, 'GCF'),
(4, 'Home Visit', 25, 'HV');

-- Seed tests - one per category (1=Wellness, 2=Nutrition, 3=Male Hormone, 4=Female Hormone, 5=Add On, 6=Sports)
INSERT IGNORE INTO tests (id, test_name, cate_id, product_model, test_sku, test_biomarker, product_description, description, `procedure`, side_effects, price, is_featured, product_unit, weights, brand_id, sort_id, status, template_type, meta_title, meta_keyword, meta_description, added_on, last_updatedon, added_by, image_url, image_banner, banner_link, prd_type, is_reorder, product_code, add_on_products, is_addon, practitioner_id) VALUES
(10, 'Basic Health Check', '1', '', 'YR001', 'Kidney, Liver, Proteins, Iron, HBA1C', '<p>Baseline health markers</p>', 'Key biomarkers for liver, kidney, diabetes and iron', '', '', '29', 'No', 'in_gm', '', 0, 1, 'Active', 'default', 'Basic Health', 'wellness', 'Basic health check', '1700000000', '1700000000', 1, '', '', '', 'Blood Test', 'yes', '', '0', 'no', 1),
(11, 'Vitamin D & B12', '2', '', 'YR002', 'Vitamin D, B12', '<p>Nutrition and vitamin levels</p>', 'Check vitamin D and B12 status', '', '', '35', 'No', 'in_gm', '', 0, 2, 'Active', 'default', 'Vitamins', 'nutrition', 'Vitamin test', '1700000000', '1700000000', 1, '', '', '', 'Blood Test', 'yes', '', '0', 'no', 1),
(12, 'Male Hormone Profile', '3', '', 'YR003', 'Testosterone, SHBG, Prolactin, FSH, LH, Oestradiol', '<p>Male hormone panel</p>', 'Key markers for testosterone therapy monitoring', '', '', '65', 'Yes', 'in_gm', '', 0, 3, 'Active', 'default', 'Male Hormone', 'male hormone', 'Male hormone profile', '1700000000', '1700000000', 1, '', '', '', 'Blood Test', 'yes', '', '0', 'no', 1),
(13, 'Testosterone Advanced', '3', '', 'YR004', 'Testosterone, Oestradiol, SHBG, Free Testosterone', '<p>Advanced male hormone test</p>', 'Detailed testosterone and related hormones', '', '', '75', 'No', 'in_gm', '', 0, 4, 'Active', 'default', 'Testosterone', 'male hormone', 'Testosterone advanced', '1700000000', '1700000000', 1, '', '', '', 'Blood Test', 'yes', '', '0', 'no', 1),
(14, 'Female Hormone Profile', '4', '', 'YR005', 'FSH, LH, Oestradiol, Prolactin, Progesterone', '<p>Female hormone panel</p>', 'Reproductive and hormonal balance markers', '', '', '65', 'No', 'in_gm', '', 0, 5, 'Active', 'default', 'Female Hormone', 'female hormone', 'Female hormone profile', '1700000000', '1700000000', 1, '', '', '', 'Blood Test', 'yes', '', '0', 'no', 1),
(15, 'Thyroid Profile', '5', '', 'YR006', 'TSH, T3, T4', '<p>Thyroid function</p>', 'Add-on thyroid panel', '', '', '39', 'No', 'in_gm', '', 0, 6, 'Active', 'default', 'Thyroid', 'add on', 'Thyroid profile', '1700000000', '1700000000', 1, '', '', '', 'Blood Test', 'yes', '', '0', 'yes', 1),
(16, 'Competitive Athlete', '6', '', 'YR007', 'FBC, Liver, Kidney, Lipids, Thyroid, Vitamins, Hormones', '<p>Full athlete panel</p>', 'Comprehensive panel for athletes', '', '', '85', 'No', 'in_gm', '', 0, 7, 'Active', 'default', 'Athlete', 'sports', 'Competitive athlete panel', '1700000000', '1700000000', 1, '', '', '', 'Blood Test', 'yes', '', '0', 'no', 1);
