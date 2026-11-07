-- Exhibit 10: posted-pay medians for open postings that name an AI skill vs those that do not, by function and level.
-- Same live-board rule as src/lib/seo/employer-rankings.ts (LIVE_PUBLIC_SQL, one row per crawlerFingerprint). USD annual ranges 30k-1M.
-- Cells need 30+ postings of each kind. Run against production; the report used the Nov 7, 2026 board.
WITH roles AS (
 SELECT DISTINCT ON (COALESCE("crawlerFingerprint","id")) "targetFunction" f, "level" lv, "salaryMin" mn, "salaryMax" mx, cardinality("aiSkillGroups")>0 ai, "salaryCurrency" cur
 FROM "ExclusiveJobPosting" WHERE "status"='approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL AND "orgScopeId" IS NULL AND COALESCE("distribution",'')='OPEN' AND COALESCE("disclosure",'OPEN')='OPEN' AND ("expiresAt" IS NULL OR "expiresAt">now()) AND COALESCE("employmentType",'') NOT IN ('internship','co_op','coop') AND COALESCE("postingType",'')<>'recruiter_search' AND COALESCE("sourceCategory",'')<>'search_firm'
 ORDER BY COALESCE("crawlerFingerprint","id"),"lastVerifiedAt" DESC NULLS LAST,"createdAt" DESC),
p AS (SELECT f,lv,ai,(mn+mx)/2.0 mid FROM roles WHERE mn>=30000 AND mx<=1000000 AND mx>=mn AND COALESCE(cur,'USD')='USD'),
cells AS (SELECT f,lv,count(*) FILTER (WHERE ai) na,count(*) FILTER (WHERE NOT ai) nn,
 (percentile_cont(.5) WITHIN GROUP (ORDER BY mid) FILTER (WHERE ai))::numeric ma, (percentile_cont(.5) WITHIN GROUP (ORDER BY mid) FILTER (WHERE NOT ai))::numeric mnn FROM p GROUP BY f,lv)
SELECT coalesce(f,'(unclassified)') AS "function", lv AS level, na, nn, round(ma) AS median_ai, round(mnn) AS median_other, round((ma/mnn-1)*100,1) AS difference_pct
FROM cells WHERE na>=30 AND nn>=30 ORDER BY f, lv;
