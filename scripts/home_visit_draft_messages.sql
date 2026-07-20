-- Nearest-phleb draft messages for home visit booking dashboard (site parity).
CREATE TABLE IF NOT EXISTS home_visit_draft_messages (
  id int NOT NULL AUTO_INCREMENT,
  order_id int NOT NULL,
  phleb_ids text,
  distances text,
  postal_code varchar(20) DEFAULT NULL,
  address text,
  lat decimal(10,7) DEFAULT NULL,
  lng decimal(10,7) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_home_visit_draft_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
