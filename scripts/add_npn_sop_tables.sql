-- Controlled SOP documents + per-phleb versioned acknowledgements.
CREATE TABLE IF NOT EXISTS npn_sop_documents (
  id int NOT NULL AUTO_INCREMENT,
  title varchar(255) NOT NULL,
  description text,
  current_version varchar(20) NOT NULL DEFAULT '1.0',
  file_url varchar(500) DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_by varchar(100) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sop_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS npn_sop_acknowledgements (
  id int NOT NULL AUTO_INCREMENT,
  phleb_id int NOT NULL,
  sop_id int NOT NULL,
  version varchar(20) NOT NULL,
  signed_by varchar(100) DEFAULT NULL,
  signed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_phleb_sop_version (phleb_id, sop_id, version),
  KEY idx_sop_id (sop_id),
  KEY idx_phleb_id (phleb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS npn_sop_document_views (
  id int NOT NULL AUTO_INCREMENT,
  phleb_id int NOT NULL,
  sop_id int NOT NULL,
  version varchar(20) NOT NULL,
  viewed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_phleb_sop_view_version (phleb_id, sop_id, version),
  KEY idx_sop_view_sop_id (sop_id),
  KEY idx_sop_view_phleb_id (phleb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
