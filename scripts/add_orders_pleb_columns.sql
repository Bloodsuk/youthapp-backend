-- Columns required by pleb job queries (production has these; local schema was older).

ALTER TABLE orders
  ADD COLUMN id_on_wp INT NULL DEFAULT NULL AFTER id,
  ADD COLUMN is_job_assigned TINYINT(1) NOT NULL DEFAULT 0;
