-- Splits the catch-all "Leads and prospects" and "Coaches, recruiters and
-- partners" lists into one list per audience. Idempotent.
INSERT INTO "MailingList" ("id", "key", "name", "description", "audience", "defaultFromName", "isActive", "sortOrder", "updatedAt") VALUES
  ('ml_higher_ed', 'higher_ed', 'Higher ed', 'Career centers, alumni offices, executive education and university administrators.', 'Colleges and universities', 'Justin Kulla', true, 3, now()),
  ('ml_workforce', 'workforce', 'Workforce, economic development and AJC', 'Workforce boards (WIOA), American Job Centers, economic development agencies and state workforce agencies.', 'WIOA / workforce boards, AJCs, economic development', 'Justin Kulla', true, 4, now()),
  ('ml_employers', 'employers', 'Employers', 'HR, talent and learning leaders at employers, including outplacement buyers.', 'CHROs, L&D heads, outplacement buyers', 'Justin Kulla', true, 5, now()),
  ('ml_recruiters', 'recruiters', 'Recruiters', 'Recruiters and search firms.', 'Recruiters and search firms', 'Justin Kulla', true, 6, now()),
  ('ml_coaches', 'coaches', 'Coaches', 'Career coaches and coaching firms.', 'Career coaches', 'Justin Kulla', true, 7, now()),
  ('ml_advisors', 'advisors', 'Advisors', 'Advisors to NextChapter.', 'Advisors', 'Justin Kulla', true, 8, now()),
  ('ml_bd_partners', 'bd_partners', 'BD partners', 'Business development and go-to-market partners.', 'BD and GTM partners', 'Justin Kulla', true, 9, now()),
  ('ml_research_partners', 'research_partners', 'Research partners', 'Researchers, think tanks and policy analysts.', 'Research and policy partners', 'Justin Kulla', true, 10, now())
ON CONFLICT ("key") DO NOTHING;

-- Copy each existing member of the two old lists to the list that fits who
-- they are (CRM role first, then the type of organization they work at).
WITH old AS (
  SELECT m.*, ol."key" AS old_key, p."roles" AS roles,
         coalesce((SELECT array_agg(DISTINCT t::text) FROM "CrmAffiliation" a JOIN "CrmOrganization" o ON o."id" = a."orgId", unnest(o."orgTypes") t WHERE a."personId" = m."personId" AND a."isCurrent"), '{}') AS org_types
  FROM "MailingListMember" m
  JOIN "MailingList" ol ON ol."id" = m."listId" AND ol."key" IN ('leads', 'ecosystem', 'customers')
  LEFT JOIN "CrmPerson" p ON p."id" = m."personId"
), target AS (
  SELECT old.*, CASE
    WHEN roles && ARRAY['ALUMNI_OFFICE','HIGHER_ED_DEVELOPMENT','HIGHER_ED_CAREER','HIGHER_ED_EXEC_ED','HIGHER_ED_ADMIN']::"CrmPersonRole"[] THEN 'higher_ed'
    WHEN roles && ARRAY['ADVISOR']::"CrmPersonRole"[] THEN 'advisors'
    WHEN roles && ARRAY['BD_PARTNER','GTM_PARTNER','STRATEGIC']::"CrmPersonRole"[] THEN 'bd_partners'
    WHEN roles && ARRAY['POLICY_ANALYST']::"CrmPersonRole"[] THEN 'research_partners'
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

-- The old catch-all lists go away. Anyone who could not be sorted stays on the
-- hidden list (never mailed) and is counted for a hand review.
UPDATE "MailingList" SET "isActive" = false, "updatedAt" = now() WHERE "key" IN ('leads', 'ecosystem', 'customers');
