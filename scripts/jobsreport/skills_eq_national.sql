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
