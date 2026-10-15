-- Local jobs report queries. Parameters: $1 = include regex on location, $2 = exclude regex.
-- Each query is separated by a "-- name:" line. The shared CTE `l` is prepended by local-report.ts.
-- Source: the app's ExclusiveJobPosting feed. History-based queries (functions gaining and losing,
-- reposts) read jobsreport_posting and return no rows until it has at least two months of data.

-- name: overview
select count(*) postings, count(distinct c) employers,
  round(100.0*count(*) filter (where agg)/nullif(count(*),0),1) pct_aggregator,
  round(avg(length(d))) avg_text_len,
  round(100.0*count(*) filter (where smin>20000)/nullif(count(*),0),1) pct_pay_stated,
  round(avg(smin) filter (where smin>20000)) avg_min_pay, round(avg(smax) filter (where smin>20000)) avg_max_pay,
  count(*) filter (where smin>20000) pay_n
from l;

-- name: overview_by_source
select case when agg then 'aggregator' else 'direct' end src, count(*) postings,
  round(100.0*count(*) filter (where smin>20000)/nullif(count(*),0),1) pct_pay_stated,
  round(avg(smin) filter (where smin>20000)) avg_min_pay, count(*) filter (where smin>20000) pay_n,
  round(100.0*count(*) filter (where is_ai)/nullif(count(*),0),1) pct_ai
from l group by 1 order by 1;

-- name: levels
select lg, count(*) postings, round(100.0*count(*)/sum(count(*)) over (),1) share,
  count(*) filter (where smin>20000) pay_n, round(avg(smin) filter (where smin>20000)) avg_min_pay,
  round(avg(smax) filter (where smin>20000)) avg_max_pay,
  round(100.0*count(*) filter (where is_ai)/nullif(count(*),0),1) pct_ai
from l group by lg order by lg;

-- name: functions
select fam, count(*) postings, count(distinct c) employers, count(*) filter (where smin>20000) pay_n,
  round(avg(smin) filter (where smin>20000)) avg_min_pay, round(avg(smax) filter (where smin>20000)) avg_max_pay,
  round(100.0*count(*) filter (where is_ai)/nullif(count(*),0),1) pct_ai
from l group by fam order by 2 desc;

-- name: ai_vs_non_ai_pay
select lg, case when is_ai then 'AI' else 'No AI' end grp, count(*) postings, count(*) filter (where smin>20000) pay_n,
  round(avg(smin) filter (where smin>20000)) avg_min_pay, round(avg(smax) filter (where smin>20000)) avg_max_pay
from l group by lg, is_ai order by lg, grp;

-- name: ai_vs_non_ai_pay_by_function
select fam, case when is_ai then 'AI' else 'No AI' end grp, count(*) postings, count(*) filter (where smin>20000) pay_n,
  round(avg(smin) filter (where smin>20000)) avg_min_pay
from l group by fam, is_ai order by fam, grp;

-- name: skills_by_ai
with sk(skill, rx) as (values
 ('SQL','\msql\M'),('Python','\mpython\M'),('Excel','\mexcel\M'),('Power BI or Tableau','(power bi|tableau)'),
 ('Cloud (AWS, Azure, Google Cloud)','\m(aws|azure|gcp|google cloud)\M'),('Enterprise software','\m(salesforce|sap|oracle|workday|netsuite|epic)\M'),
 ('Project management','\m(project management|pmp|agile|scrum)\M'),('Finance (budgeting, forecasting, GAAP)','\m(gaap|cpa|fp&a|forecasting|financial modeling|budget\w*)\M'),
 ('Compliance and regulatory','\m(compliance|regulatory|audit)\M'),('Supply chain','\m(supply chain|logistics|procurement|inventory)\M'),
 ('Clinical licensure','\m(rn|bsn|lpn|nursing|licensed|licensure)\M'),('Cybersecurity','\m(cyber\w*|infosec|security engineer)\M'),
 ('Data analysis','\m(data analysis|analytics|data analyst|business intelligence)\M'),('Customer experience','\m(customer experience|customer success|customer service)\M'),
 ('Strategy','\m(strategy|strategic)\M'),('Change management','change management'),
 ('Leadership','\m(leadership|lead a team|leading teams)'),('Communication','communicat'),
 ('Teamwork or collaboration','\m(collaborat|teamwork|team player|cross-functional)'),('Creativity or innovation','\m(creativ|innovat)'),
 ('Empathy, emotional intelligence, adaptability','\m(empath|emotional intelligence|adaptab)'),('Problem solving','problem[- ]solving'))
select sk.skill, count(*) filter (where l.is_ai) ai_n, count(*) filter (where not l.is_ai) non_ai_n,
  round(100.0*count(*) filter (where l.is_ai and l.d ~ sk.rx)/nullif(count(*) filter (where l.is_ai),0),1) pct_in_ai,
  round(100.0*count(*) filter (where not l.is_ai and l.d ~ sk.rx)/nullif(count(*) filter (where not l.is_ai),0),1) pct_in_non_ai,
  count(*) filter (where l.d ~ sk.rx) postings_with_skill
from sk cross join l group by sk.skill order by postings_with_skill desc;

-- name: arrangement
select case when d ~ '\mhybrid\M' then 'hybrid' when d ~ '\m(fully remote|100% remote|work from home|remote position|remote role|remote)\M' then 'remote'
  when d ~ '\m(on-?site|in-?office|in office)\M' then 'on-site' else 'not stated' end arrangement,
  count(*) postings, round(100.0*count(*)/sum(count(*)) over (),1) share,
  count(*) filter (where smin>20000) pay_n, round(avg(smin) filter (where smin>20000)) avg_min_pay
from l group by 1 order by 2 desc;

-- name: benefits_culture
select count(*) postings,
  count(*) filter (where d ~ '401\(?k') b_401k, count(*) filter (where d ~ '\m(health|medical) (insurance|benefits|coverage|plan)') b_health,
  count(*) filter (where d ~ '\m(pto|paid time off|vacation)\M') b_pto, count(*) filter (where d ~ '\m(tuition|education assistance)') b_tuition,
  count(*) filter (where d ~ '\m(parental|maternity|paternity) leave') b_parental, count(*) filter (where d ~ '\m(equity|stock|rsu)\M') b_equity,
  count(*) filter (where d ~ '\mbonus\M') b_bonus, count(*) filter (where d ~ '(sign-on|signing bonus|relocation)') b_signon,
  count(*) filter (where d ~ '(fast-paced|fast paced|high-pressure|hustle|thrive under pressure)') culture_intense,
  count(*) filter (where d ~ '(work-life balance|work/life balance|flexib\w+ schedule|flexible work)') culture_balance,
  count(*) filter (where d ~ '(talent pool|future opportunit|always hiring|talent community|talent network)') evergreen
from l;

-- name: engagement
select k engagement, count(*) postings from (select unnest(array_remove(array[
  case when d ~ '(1099|independent contractor|freelanc)' then '1099 or freelance' end,
  case when d ~ '(contract-to-hire|contract to hire|\mc2h\M)' then 'contract-to-hire' end,
  case when d ~ '\m(contract position|contract role|contractor|\mcontract\M)' and d !~ '(1099|independent contractor|freelanc|contract-to-hire|contract to hire)' then 'contract' end,
  case when d ~ '\mfractional\M' then 'fractional' end, case when d ~ '\minterim\M' then 'interim' end,
  case when d ~ '(part-time|part time|per diem|temporary)' then 'part-time or temporary' end], null)) k from l) e
group by k order by 2 desc;

-- name: employers
select case when n=1 then '1 posting' when n<=5 then '2-5' when n<=20 then '6-20' else '21+' end band, count(*) employers, sum(n) postings
from (select c, count(*) n from l group by c) e group by 1 order by 1;

-- name: top_employers
select c employer, count(*) postings, count(*) filter (where smin>20000) pay_n, round(avg(smin) filter (where smin>20000)) avg_min_pay
from l where c !~* 'jooble|jobrapido|confidential|staffing|recruit|talent|search|vaco|robert half|randstad|manpower' group by c order by 2 desc limit 15;
