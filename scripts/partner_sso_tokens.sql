-- One-time SSO tokens for phleb app → WordPress partner login.
CREATE TABLE IF NOT EXISTS partner_sso_tokens (
  token char(64) NOT NULL,
  email varchar(255) NOT NULL,
  expires_at datetime NOT NULL,
  used tinyint(1) NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token),
  KEY idx_partner_sso_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
