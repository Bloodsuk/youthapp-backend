-- Align existing SOP tables with acknowledgement app spec (safe for re-run).
-- Columns are added only when missing (checked by deploy / migration runner).

CREATE TABLE IF NOT EXISTS npn_sop_version_notifications (
  id int NOT NULL AUTO_INCREMENT,
  phleb_id int NOT NULL,
  sop_id int NOT NULL,
  version varchar(20) NOT NULL,
  notified_at datetime NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_phleb_sop_version (phleb_id, sop_id, version),
  KEY idx_sop_id (sop_id),
  KEY idx_phleb_id (phleb_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Mark the three required acknowledgement documents (by code/title).
-- Live admin UI uses `is_required_ack`; keep `requires_acknowledgement` in sync when present.
UPDATE npn_sop_documents
SET is_required_ack = 1,
    requires_acknowledgement = 1,
    document_code = CASE
      WHEN title LIKE '%YR_SD_014%' OR title LIKE '%Mobile Phlebotomy Booklet%' THEN 'YR_SD_014'
      WHEN title LIKE '%YR_SOP_008%' OR (
        (title LIKE '%Phlebotomy Procedure%' OR title LIKE '%Phlebotomy Proceedure%')
        AND title NOT LIKE '%Presentation%'
        AND title NOT LIKE '%Policy%'
      ) THEN 'YR_SOP_008'
      WHEN title LIKE '%YR_SOP_005%' OR (
        title LIKE '%Safeguarding Policy%' AND title NOT LIKE '%Presentation%'
      ) THEN 'YR_SOP_005'
      ELSE document_code
    END
WHERE
  title LIKE '%YR_SD_014%'
  OR title LIKE '%Mobile Phlebotomy Booklet%'
  OR title LIKE '%YR_SOP_008%'
  OR (
    (title LIKE '%Phlebotomy Procedure%' OR title LIKE '%Phlebotomy Proceedure%')
    AND title NOT LIKE '%Presentation%'
    AND title NOT LIKE '%Policy%'
  )
  OR title LIKE '%YR_SOP_005%'
  OR (title LIKE '%Safeguarding Policy%' AND title NOT LIKE '%Presentation%');

-- Safeguarding Presentation belongs in Training Matrix — hide from SOP list/dashboard.
UPDATE npn_sop_documents
SET is_active = 0,
    is_required_ack = 0,
    requires_acknowledgement = 0,
    document_code = COALESCE(document_code, 'YR_SD_016')
WHERE title LIKE '%YR_SD_016%'
   OR title LIKE '%Safeguarding Presentation%';

-- Everything else is reference-only (no tick).
UPDATE npn_sop_documents
SET is_required_ack = 0,
    requires_acknowledgement = 0
WHERE (is_required_ack = 1 OR requires_acknowledgement = 1)
  AND NOT (
    title LIKE '%YR_SD_014%'
    OR title LIKE '%Mobile Phlebotomy Booklet%'
    OR title LIKE '%YR_SOP_008%'
    OR (title LIKE '%Phlebotomy Procedure%' AND title NOT LIKE '%Presentation%' AND title NOT LIKE '%Policy%')
    OR (title LIKE '%Phlebotomy Proceedure%' AND title NOT LIKE '%Presentation%' AND title NOT LIKE '%Policy%')
    OR title LIKE '%YR_SOP_005%'
    OR (title LIKE '%Safeguarding Policy%' AND title NOT LIKE '%Presentation%')
  );

-- Legacy admin dashboards still check Safeguarding Presentation (id/title).
-- If Policy is acknowledged, mirror that ack so Presentation no longer shows pending.
INSERT INTO npn_sop_acknowledgements (phleb_id, sop_id, version, signed_by, signed_at)
SELECT a.phleb_id, pres.id, a.version, a.signed_by, a.signed_at
FROM npn_sop_acknowledgements a
INNER JOIN npn_sop_documents pol
  ON pol.id = a.sop_id
 AND (pol.title LIKE '%Safeguarding Policy%' AND pol.title NOT LIKE '%Presentation%')
INNER JOIN npn_sop_documents pres
  ON (pres.title LIKE '%Safeguarding Presentation%' OR pres.title LIKE '%YR_SD_016%')
WHERE NOT EXISTS (
  SELECT 1 FROM npn_sop_acknowledgements x
  WHERE x.phleb_id = a.phleb_id
    AND x.sop_id = pres.id
    AND x.version = a.version
);