-- Assign one pleb_job to a phlebotomist by email.
-- phlebotomy_applications.id is the same id returned as user.id on Phlebotomist login
-- and used in GET /api/pleb_jobs/pleb/:pleb_id
--
-- 1) Set the email, run the SET blocks, then SELECT to verify @pleb_id and @order_id.
-- 2) If both non-NULL, run the INSERT and UPDATE.

SET @pleb_email := 'sonusmartpoint@gmail.com';

SET @pleb_id := (
  SELECT id FROM phlebotomy_applications
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(@pleb_email))
  LIMIT 1
);

SET @order_id := (
  SELECT o.id
  FROM orders o
  WHERE COALESCE(o.is_job_assigned, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM pleb_jobs pj WHERE pj.order_id = o.id)
  ORDER BY o.id DESC
  LIMIT 1
);

-- Verify before insert:
SELECT @pleb_id AS pleb_id, @order_id AS order_id;

-- Only inserts when both are set (avoids NULL pleb_id / order_id rows):
INSERT INTO pleb_jobs (pleb_id, order_id, job_status, created_at)
SELECT @pleb_id, @order_id, 'Assigned', NOW()
FROM DUAL
WHERE @pleb_id IS NOT NULL AND @order_id IS NOT NULL;

UPDATE orders o
SET is_job_assigned = 1
WHERE o.id = @order_id
  AND @order_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM pleb_jobs pj WHERE pj.order_id = o.id);
