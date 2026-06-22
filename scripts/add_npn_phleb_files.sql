-- Phleb compliance document uploads (linked to npn_phleb_signoffs.item_key)
CREATE TABLE IF NOT EXISTS npn_phleb_files (
  id int NOT NULL AUTO_INCREMENT,
  phleb_id int NOT NULL,
  item_key varchar(80) NOT NULL,
  file_name varchar(255) NOT NULL,
  file_path varchar(512) NOT NULL,
  mime_type varchar(128) DEFAULT NULL,
  file_size int DEFAULT NULL,
  status enum('pending_review','approved','rejected') NOT NULL DEFAULT 'pending_review',
  expiry_date date DEFAULT NULL,
  notes text DEFAULT NULL,
  uploaded_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by varchar(150) DEFAULT NULL,
  reviewed_at timestamp NULL DEFAULT NULL,
  is_current tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_phleb_item (phleb_id, item_key),
  KEY idx_phleb_current (phleb_id, item_key, is_current),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
