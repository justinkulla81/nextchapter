-- National skills and emotional-intelligence (EQ) language, white-collar frame (SOC major groups 11 to 29), live postings.
-- Run once a month against production, read-only. Run 2026-11-24 for the November 2026 draft.
-- Cost: query 1 and 3 read narrow columns of ~680k rows and return under 100 rows; query 2 reads descriptions of a ~4% block
-- sample (~15k white-collar postings, ~75 MB of text inside the database, nothing large leaves it). Do not widen the sample or
-- loop it: description text is the heaviest column. TABLESAMPLE SYSTEM picks whole blocks, so the sample is not strictly random.

-- 1. Structured signals (postingSignals, from src/lib/jobs/posting-signals.ts) by AI mention, and skills coverage
with b as (select "aiMention" aim, "postingSignals" ps, "skills" sk from "ExclusiveJobPosting" where "archivedAt" is null and "socCode" ~ '^(1[1-9]|2[0-9])-')
select 'signals' k, coalesce(aim::text,'null') g, s val, count(*) n from b, unnest(case when ps is null or cardinality(ps)=0 then array['(none)'] else ps end) s group by 1,2,3
union all select 'frame', coalesce(aim::text,'null'), 'total', count(*) from b group by 2
union all select 'hasSkills', coalesce(aim::text,'null'), 'with skills', count(*) filter (where sk is not null and cardinality(sk)>0) from b group by 2
union all select 'avgSkills', coalesce(aim::text,'null'), 'avg count', round(avg(cardinality(sk)) filter (where cardinality(sk)>0)::numeric,2) from b group by 2;

-- 2. EQ and soft-skill words in posting text, by AI mention and level (sample)
with b as (select "aiMention" aim, case when "level" in ('ENTRY_IC','EARLY_IC') then 'entry' when "level" in ('MID_IC','SENIOR_IC','PRINCIPAL') then 'ic' else 'mgr' end lv, lower("description") d
 from "ExclusiveJobPosting" tablesample system (4) where "archivedAt" is null and "socCode" ~ '^(1[1-9]|2[0-9])-' and "aiMention" is not null)
select coalesce(aim::text,'all') aim, coalesce(lv,'all') lv, count(*) n,
 count(*) filter (where d ~ 'emotional intelligence|\meq\M|emotionally intelligent') eq,
 count(*) filter (where d ~ 'empath') empathy,
 count(*) filter (where d ~ 'self-aware') selfaware,
 count(*) filter (where d ~ 'communicat') comm,
 count(*) filter (where d ~ 'collaborat|teamwork|team player') collab,
 count(*) filter (where d ~ 'adaptab|resilien|agility') adapt,
 count(*) filter (where d ~ 'problem[- ]solving') ps,
 count(*) filter (where d ~ 'critical thinking') ct,
 count(*) filter (where d ~ 'active listening|strong listener') listen,
 count(*) filter (where d ~ 'empath|emotional intelligence|\meq\M|self-aware|active listening|interpersonal') anyeq
from b group by grouping sets ((aim,lv),(aim),(lv),());

-- 3. Named skills (tagged vocabulary) by AI mention, shares among postings that have a skills list
with b as (select "aiMention" aim, "skills" sk from "ExclusiveJobPosting" where "archivedAt" is null and "socCode" ~ '^(1[1-9]|2[0-9])-' and cardinality("skills")>0 and "aiMention" is not null),
 t as (select aim, count(*) tot from b group by aim), s as (select aim, lower(x) sk, count(*) n from b, unnest(sk) x group by 1,2)
select s.aim, s.sk, s.n, round(100.0*s.n/t.tot,1) pct, t.tot from s join t using(aim) where s.n>=2000 order by s.aim, s.n desc;

-- 4. AI-washing risk: postings that mention AI but name no AI skill, tool or skill group (white-collar frame, live postings)
-- Run 2026-11-24. One pass over narrow columns, under 20 rows out. "Boilerplate-only" is a classification, not proof of washing.
with b as (select case when "level" in ('ENTRY_IC','EARLY_IC') then 'entry' when "level" in ('MID_IC','SENIOR_IC','PRINCIPAL') then 'ic' else 'mgr' end lv, coalesce("industry",'(none)') ind,
 (cardinality(coalesce("aiSkillItems",'{}'))=0 and cardinality(coalesce("aiToolsNamed",'{}'))=0 and cardinality(coalesce("aiSkillGroups",'{}'))=0) boiler,
 (cardinality(coalesce("aiToolsNamed",'{}'))>0) tools
 from "ExclusiveJobPosting" where "archivedAt" is null and "socCode" ~ '^(1[1-9]|2[0-9])-' and "aiMention" is true)
select coalesce(lv,'all') lv, case when grouping(ind)=1 then 'all' else ind end ind, count(*) n, count(*) filter (where boiler) boiler, count(*) filter (where tools) tools
from b group by grouping sets ((lv),(ind),()) having count(*)>=1500 or (lv is not null);

-- 5. Pay and benefits by employer industry (white-collar frame, live postings). Run 2026-11-24; one pass, narrow columns, ~20 rows out.
with b as (select coalesce("industry",'(none)') ind, ("salaryMin" is not null) pay, case when "payPeriod"='year' and "salaryMin" between 20000 and 1000000 then ("salaryMin"+coalesce("salaryMax","salaryMin"))/2.0 end mid,
 (jsonb_typeof("benefits")='object' and "benefits"<>'{}'::jsonb) ben, ("benefits"->>'strong')='true' strong, ("benefits"->>'health')='true' health, ("benefits"->>'k401')='true' k401, ("benefits"->>'pto')='true' pto, ("benefits"->>'parental_leave')='true' parl, ("benefits"->>'tuition')='true' tui, ("benefits"->>'equity')='true' eq
 from "ExclusiveJobPosting" where "archivedAt" is null and "socCode" ~ '^(1[1-9]|2[0-9])-')
select case when grouping(ind)=1 then 'all' else ind end ind, count(*) n, count(*) filter (where pay) pay, count(mid) annual, round(percentile_cont(0.5) within group (order by mid)::numeric) med,
 count(*) filter (where ben) ben, count(*) filter (where strong) strong, count(*) filter (where health) health, count(*) filter (where k401) k401, count(*) filter (where pto) pto, count(*) filter (where parl) parl, count(*) filter (where tui) tui, count(*) filter (where eq) eq
from b group by rollup(ind) order by 2 desc;

-- 6. Ghost risk and reposts (white-collar frame, live postings). Run 2026-11-24; one pass, narrow columns, ~50 rows out.
-- Mirrors ghostRisk() in src/lib/jobs/ghost-risk.ts without member flags: prior closures = greatest(repostCount, reopenCount),
-- age = days since createdAt, still listed = direct listing verified within 8 days. Keep in step with that file.
with r as (select case when "level" in ('ENTRY_IC','EARLY_IC') then 'entry' when "level" in ('MID_IC','SENIOR_IC','PRINCIPAL') then 'ic' else 'mgr' end lv, coalesce("industry",'(none)') ind, coalesce("directListing",false) dl,
 greatest(coalesce("repostCount",0),coalesce("reopenCount",0)) prior, extract(epoch from (now()-"createdAt"))/86400 age,
 (coalesce("directListing",false) and "lastVerifiedAt" >= now()-interval '8 days') still
 from "ExclusiveJobPosting" where "archivedAt" is null and "socCode" ~ '^(1[1-9]|2[0-9])-'),
g as (select *, case when prior>=2 then 'likely' when age>90 then (case when not still then 'likely' when prior=1 then 'likely' else 'watch' end) when prior=1 then 'watch' when age>60 then 'watch' else 'none' end gl,
 case when age<=30 then '0-30' when age<=60 then '31-60' when age<=90 then '61-90' when age<=180 then '91-180' else '181+' end ab from r)
select case when grouping(lv)=0 then 'level' when grouping(ind)=0 then 'industry' when grouping(dl)=0 then 'direct' when grouping(ab)=0 then 'ageband' when grouping(prior)=0 then 'prior' when grouping(gl)=0 then 'overall' else 'total' end dim,
 coalesce(lv,ind,dl::text,ab,prior::text,gl,'') val, count(*) n, count(*) filter (where gl='likely') likely, count(*) filter (where gl='watch') watch, round(percentile_cont(0.5) within group (order by age)::numeric) med_age
from g group by grouping sets ((lv),(ind),(dl),(ab),(prior),(gl),()) order by 1,2;
