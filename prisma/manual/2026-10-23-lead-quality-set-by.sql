-- Who set an organization's grade: 'AUTO' (the nightly grading job, free to raise it),
-- 'ADMIN' (set by hand, never touched), NULL (not graded yet, or graded before this column
-- existed and so treated as hand-set). Additive; run before deploying.
ALTER TABLE "CrmOrganization" ADD COLUMN IF NOT EXISTS "leadQualitySetBy" TEXT;

-- Mark the grades the first two grading passes wrote. A grade that matches either rule's
-- result for the organization today is treated as automatic; anything else stays protected.
UPDATE "CrmOrganization" o SET "leadQualitySetBy" = 'AUTO'
FROM (
  SELECT o2.id,
    EXISTS (SELECT 1 FROM "WarnNotice" w WHERE w."companyId" = o2."companyId") AS warn,
    COALESCE((SELECT h."openNow" FROM "CompanyHiringProfile" h WHERE h."companyId" = o2."companyId"), 0) AS open_now,
    o2."emailDomain" IS NOT NULL AS has_domain
  FROM "CrmOrganization" o2
  WHERE 'EMPLOYER' = ANY (o2."orgTypes"::text[])
) s
WHERE o.id = s.id
  AND o."leadQualitySetBy" IS NULL
  AND o."leadQuality" <> 'UNGRADED'
  AND o."leadQuality"::text IN (
    CASE WHEN s.warn THEN 'A' WHEN s.open_now > 5 THEN 'B' ELSE 'C' END,
    CASE WHEN s.warn THEN 'A' WHEN s.has_domain THEN 'B' ELSE 'C' END
  );
