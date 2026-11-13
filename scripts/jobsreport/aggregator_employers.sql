-- Employers with MORE THAN ONE live Jooble or Careerjet job: the list to go direct for (docs/jobs-report/go-direct-loop.md).
-- Run once per cycle from a session or the Supabase SQL editor; save the JSON result as the input of go_direct.py
-- (`scripts/jobsreport/out/aggregator-employers-YYYY-MM-DD.json`, a list of {co, rows_total, jooble, careerjet, company_id}).
--
-- Cost: one grouped pass over live rows with sourceCategory 'aggregator' (no index covers it), narrow columns only, no
-- description. It returns one summary row plus the top N employers as JSON, not the 18,000-employer list. Do not loop it
-- (CLAUDE.md, "Database egress"). Raise the limit instead of re-running to look further down the list.
-- 2026-11-13: 18,703 employers, 135,731 rows; the top 150 held 22,000 rows.
with a as (
  select lower(btrim("companyName")) as co,
         case when url ~* '^https?://([a-z0-9-]+\.)*jooble\.org' then 'jooble' else 'careerjet' end as agg,
         "companyId" as cid
  from "ExclusiveJobPosting"
  where status = 'approved' and "archivedAt" is null and "closeReason" is null
    and "sourceCategory" = 'aggregator'
    and url ~* '^https?://([a-z0-9-]+\.)*(jooble\.org|jobviewtrack\.com|careerjet\.[a-z.]+)'
    and coalesce("directListing", false) is false
), g as (
  select co, count(*) as rows_total,
         count(*) filter (where agg = 'jooble') as jooble,
         count(*) filter (where agg = 'careerjet') as careerjet,
         max(cid) as company_id
  from a where co <> '' group by co having count(*) > 1
)
select (select count(*) from g) as employers_gt1, (select sum(rows_total) from g) as rows_gt1,
       (select json_agg(t) from (select co, rows_total, jooble, careerjet, company_id from g order by rows_total desc limit 1000) t) as top;
