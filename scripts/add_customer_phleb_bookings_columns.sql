-- Additive columns for customer_phleb_bookings (WordPress wp_customer_phleb_bookings parity).
-- Safe to run multiple times only if your MySQL supports IF NOT EXISTS on columns (8.0.12+).
-- Deploy script also checks information_schema before ALTER.

ALTER TABLE customer_phleb_bookings
  ADD COLUMN IF NOT EXISTS available_days varchar(50) DEFAULT NULL
    COMMENT 'Comma-separated day abbreviations, e.g. Mon,Tue,Fri',
  ADD COLUMN IF NOT EXISTS blood_draw_issues varchar(5) DEFAULT NULL
    COMMENT 'yes / no',
  ADD COLUMN IF NOT EXISTS blood_draw_issue_types text DEFAULT NULL
    COMMENT 'Comma-separated checklist when blood_draw_issues = yes',
  ADD COLUMN IF NOT EXISTS blood_draw_issue_detail text DEFAULT NULL
    COMMENT 'Free-text detail when blood_draw_issues = yes',
  ADD COLUMN IF NOT EXISTS customer_postcode varchar(10) DEFAULT NULL;
