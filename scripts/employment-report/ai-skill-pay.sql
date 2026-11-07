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

-- Within-employer version (Exhibit 10, first row): same companyId, targetFunction and level; cells with 3+ postings of each kind.
-- Result, Nov 7, 2026: 306 cells, 144 employers, 2,281 AI-naming and 4,931 other postings; median +0.9%, posting-weighted +3.9%, 159 cells up / 89 down / 58 equal.
-- (Same roles/p CTEs as above, with "companyId" c and p restricted to c IS NOT NULL AND f IS NOT NULL.)
-- cells AS (SELECT c,f,lv,count(*) FILTER (WHERE ai) na,count(*) FILTER (WHERE NOT ai) nn,
--   percentile_cont(.5) WITHIN GROUP (ORDER BY mid) FILTER (WHERE ai) ma, percentile_cont(.5) WITHIN GROUP (ORDER BY mid) FILTER (WHERE NOT ai) mnn FROM p GROUP BY c,f,lv),
-- q AS (SELECT *, ln(ma/mnn) g FROM cells WHERE na>=3 AND nn>=3)
-- SELECT count(*), count(DISTINCT c), round((exp(percentile_cont(.5) WITHIN GROUP (ORDER BY g))-1)*100,1), round((exp(sum(g*na)/sum(na))-1)*100,1) FROM q;
