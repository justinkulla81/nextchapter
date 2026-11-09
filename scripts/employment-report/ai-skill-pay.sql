-- Exhibit 9: posted-pay medians for open postings that name an AI skill vs those that do not, by function and level.
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

-- Within-employer version (Exhibit 9, first row): same companyId, targetFunction and level; cells with 3+ postings of each kind.
-- Result, Nov 7, 2026: 306 cells, 144 employers, 2,281 AI-naming and 4,931 other postings; median +0.9%, posting-weighted +3.9%, 159 cells up / 89 down / 58 equal.
-- (Same roles/p CTEs as above, with "companyId" c and p restricted to c IS NOT NULL AND f IS NOT NULL.)
-- cells AS (SELECT c,f,lv,count(*) FILTER (WHERE ai) na,count(*) FILTER (WHERE NOT ai) nn,
--   percentile_cont(.5) WITHIN GROUP (ORDER BY mid) FILTER (WHERE ai) ma, percentile_cont(.5) WITHIN GROUP (ORDER BY mid) FILTER (WHERE NOT ai) mnn FROM p GROUP BY c,f,lv),
-- q AS (SELECT *, ln(ma/mnn) g FROM cells WHERE na>=3 AND nn>=3)
-- SELECT count(*), count(DISTINCT c), round((exp(percentile_cont(.5) WITHIN GROUP (ORDER BY g))-1)*100,1), round((exp(sum(g*na)/sum(na))-1)*100,1) FROM q;

-- Employer-class check (version 1.4): postings NOT naming AI at employers with >=5 AI-naming live postings vs postings at all other employers,
-- by function and level (cells with 30+ of each). Run through a one-off edge function (the 60 s tool limit is too short); result Nov 7, 2026:
-- 113 cells, median +24.3%, 110 higher, quartiles +17.2% / +31.3%; 2,292 asking employers of 57,648 hold 42.5% of open roles and 82.4% of AI-naming roles.
-- Shape: roles (as above) -> emp AS (SELECT c, count(*) n, count(*) FILTER (WHERE ai) na FROM roles GROUP BY c) -> p joins emp, askers = na>=5
--   -> cells: median mid for (askers AND NOT ai) vs (NOT askers) -> ln ratio, summarized by median and quartiles.

-- Version 1.5: software postings by title (regex on "title": software/swe engineer or developer, full-stack, back/front-end, mobile, iOS/Android,
-- machine learning, devops, site reliability, data engineer). Nov 7, 2026 result: 29,605 postings, 6,010 employers, 32.2% name AI skills,
-- 27.4% entry/early-career, 51.8% senior+, median posted pay $192,500 (7,951 with pay; AI-naming $210,800, other $178,125). Run through a one-off edge function.

-- Version 1.6: AI-skill postings by employer industry (Company.industry), outside Technology & Software, by function, concentration. Nov 8, 2026:
-- 559,278 jobs, 58,659 naming AI (10.5%); Technology & Software 65,026 jobs, 29.7%, 32.9% of AI-naming jobs; outside it 39,350 AI jobs = 8.0% of 494,252.
-- Shape: roles (as above) LEFT JOIN "Company" co ON co.id = companyId; emp = per employer (n, na); industry table = sum by co.industry; top-N by na within/outside technology.
