-- Kits: per-phleb stock balances + request priority (additive / safe to re-run where noted).

CREATE TABLE IF NOT EXISTS npn_phleb_kit_stock (
  id int NOT NULL AUTO_INCREMENT,
  phleb_id int NOT NULL,
  kit_type_id int NOT NULL,
  current_balance int NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_phleb_kit (phleb_id, kit_type_id),
  KEY idx_phleb (phleb_id),
  KEY idx_kit (kit_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- priority on kit requests (run once; skip if column already exists)
ALTER TABLE npn_kit_requests
  ADD COLUMN priority enum('Normal','Urgent') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Normal'
  AFTER quantity_requested;
