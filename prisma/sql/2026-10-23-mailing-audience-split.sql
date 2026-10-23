-- Splits the catch-all "Leads and prospects" and "Coaches, recruiters and
-- partners" lists into one list per audience. Idempotent.
INSERT INTO "MailingList" ("id", "key", "name", "description", "audience", "defaultFromName", "isActive", "sortOrder", "updatedAt") VALUES
  ('ml_higher_ed', 'higher_ed', 'Higher ed', 'Career centers, alumni offices, executive education and university administrators.', 'Colleges and universities', 'Justin Kulla', true, 3, now()),
  ('ml_workforce', 'workforce', 'Workforce, economic development and AJC', 'Workforce boards (WIOA), American Job Centers, economic development agencies and state workforce agencies.', 'WIOA / workforce boards, AJCs, economic development', 'Justin Kulla', true, 4, now()),
  ('ml_employers', 'employers', 'Employers', 'HR, talent and learning leaders at employers, including outplacement buyers.', 'CHROs, L&D heads, outplacement buyers', 'Justin Kulla', true, 5, now()),
  ('ml_recruiters', 'recruiters', 'Recruiters', 'Recruiters and search firms.', 'Recruiters and search firms', 'Justin Kulla', true, 6, now()),
  ('ml_coaches', 'coaches', 'Coaches', 'Career coaches and coaching firms.', 'Career coaches', 'Justin Kulla', true, 7, now())
ON CONFLICT ("key") DO NOTHING;

-- Copy each existing member of the two old lists to the list that fits who
-- they are (CRM role first, then the type of organization they work at).
WITH old AS (
  SELECT m.*, ol."key" AS old_key, p."roles" AS roles,
         coalesce((SELECT array_agg(DISTINCT t::text) FROM "CrmAffiliation" a JOIN "CrmOrganization" o ON o."id" = a."orgId", unnest(o."orgTypes") t WHERE a."personId" = m."personId" AND a."isCurrent"), '{}') AS org_types
  FROM "MailingListMember" m
  JOIN "MailingList" ol ON ol."id" = m."listId" AND ol."key" IN ('leads', 'ecosystem')
  LEFT JOIN "CrmPerson" p ON p."id" = m."personId"
), target AS (
  SELECT old.*, CASE
    WHEN roles && ARRAY['ALUMNI_OFFICE','HIGHER_ED_DEVELOPMENT','HIGHER_ED_CAREER','HIGHER_ED_EXEC_ED','HIGHER_ED_ADMIN']::"CrmPersonRole"[] THEN 'higher_ed'
    WHEN roles && ARRAY['RECRUITER_PROSPECT']::"CrmPersonRole"[] THEN 'recruiters'
    WHEN roles && ARRAY['COACH_PROSPECT']::"CrmPersonRole"[] THEN 'coaches'
    WHEN roles && ARRAY['CHRO','LEARNING_DEV_HEAD','OUTPLACEMENT_BUYER']::"CrmPersonRole"[] THEN 'employers'
    WHEN org_types && ARRAY['WORKFORCE_PROVIDER','GOVERNMENT']::text[] THEN 'workforce'
    WHEN org_types && ARRAY['UNIVERSITY']::text[] THEN 'higher_ed'
    WHEN org_types && ARRAY['SEARCH_FIRM']::text[] THEN 'recruiters'
    WHEN org_types && ARRAY['COACHING_FIRM']::text[] THEN 'coaches'
    WHEN org_types && ARRAY['EMPLOYER','OUTPLACEMENT_LEAD','OUTPLACEMENT_FIRM']::text[] THEN 'employers'
    ELSE NULL END AS new_key
  FROM old
)
INSERT INTO "MailingListMember" ("id", "listId", "email", "personId", "status", "addedVia", "consentNote", "addedAt", "statusAt")
SELECT 'mlm_split_' || t."id", nl."id", t."email", t."personId", t."status", t."addedVia", t."consentNote", t."addedAt", t."statusAt"
FROM target t JOIN "MailingList" nl ON nl."key" = t.new_key
WHERE t.new_key IS NOT NULL
ON CONFLICT ("listId", "email") DO NOTHING;

-- Retire an old list only when nobody is left on it that still needs sorting;
-- otherwise keep it, renamed, so those people can be placed by hand.
UPDATE "MailingList" l SET "isActive" = false, "updatedAt" = now()
WHERE l."key" IN ('leads', 'ecosystem')
  AND NOT EXISTS (
    SELECT 1 FROM "MailingListMember" m WHERE m."listId" = l."id" AND m."status" = 'ACTIVE'
      AND NOT EXISTS (SELECT 1 FROM "MailingListMember" m2 JOIN "MailingList" nl ON nl."id" = m2."listId"
        WHERE m2."email" = m."email" AND nl."key" IN ('higher_ed','recruiters','coaches','employers','workforce'))
  );
UPDATE "MailingList" SET "name" = 'Unsorted leads (place by hand)', "updatedAt" = now() WHERE "key" = 'leads' AND "isActive";
UPDATE "MailingList" SET "name" = 'Unsorted partners (place by hand)', "updatedAt" = now() WHERE "key" = 'ecosystem' AND "isActive";
