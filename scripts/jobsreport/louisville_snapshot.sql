-- Louisville snapshot queries against the app's ExclusiveJobPosting feed.
-- Excludes Louisville CO/NE and archived rows. Re-run as the feed grows.
-- Frame: mid-level and above only (the feed has no entry-level postings).

-- 1) Size, level, pay, text signals
with l as (
  select *, case when level = 'MID_IC' then 'Mid-level IC' when level is null then 'Unknown' else 'Manager and above' end lg,
         lower(coalesce(description,'')) d
  from "ExclusiveJobPosting"
  where location ilike '%louisville%' and location !~* 'louisville,?\s*(co|colorado|ne)\M' and "archivedAt" is null)
select lg, count(*) n, count(distinct "companyName") employers,
  count(*) filter (where url ilike '%jooble%') jooble,
  count(*) filter (where "salaryMin" > 20000) with_pay,
  round(avg("salaryMin") filter (where "salaryMin" > 20000)) avg_min_pay,
  count(*) filter (where d ~ '\m(ai|a\.i\.|artificial intelligence|machine learning|generative|llm|llms|copilot|chatgpt|genai)\M') ai_any,
  count(*) filter (where d ~ '\m(remote|work from home|telecommut\w*)\M' and d !~ '\mhybrid\M') remote_txt,
  count(*) filter (where d ~ '\mhybrid\M') hybrid_txt,
  count(*) filter (where d ~ '\m(on-site|onsite|on site|in-office|in office)\M') onsite_txt,
  count(*) filter (where d ~ '401\(?k') b_401k,
  count(*) filter (where d ~ '\m(pto|paid time off|vacation)\M') b_pto,
  count(*) filter (where d ~ 'communicat') eq_comm,
  count(*) filter (where d ~ '\m(leadership|lead a team|leading teams)') eq_lead,
  count(*) filter (where d ~ '\m(collaborat|teamwork|team player|cross-functional)') eq_team,
  count(*) filter (where d ~ '\m(creativ|innovat)') eq_creative,
  count(*) filter (where d ~ '(fast-paced|fast paced|high-pressure|hustle|thrive under pressure)') cul_intense,
  count(*) filter (where d ~ '(work-life balance|work/life balance|flexib\w+ schedule|flexible work)') cul_balance,
  count(*) filter (where d ~ '(talent pool|future opportunit|always hiring|talent community|talent network)') evergreen
from l group by rollup(lg) order by 1;

-- 2) Employers by number of postings
with l as (select "companyName" c from "ExclusiveJobPosting"
           where location ilike '%louisville%' and location !~* 'louisville,?\s*(co|colorado|ne)\M' and "archivedAt" is null),
     e as (select c, count(*) n from l group by c)
select case when n=1 then '1 posting' when n<=5 then '2-5' when n<=20 then '6-20' else '21+' end band,
       count(*) employers, sum(n) postings
from e group by 1 order by 1;

-- 3) Gap check on the largest employers
with l as (select "companyName" c from "ExclusiveJobPosting"
           where location ilike '%louisville%' and location !~* 'louisville,?\s*(co|colorado|ne)\M' and "archivedAt" is null)
select count(*) total,
  count(*) filter (where c ~* 'united parcel|^ups\M') ups, count(*) filter (where c ~* 'ford motor') ford,
  count(*) filter (where c ~* 'kroger') kroger, count(*) filter (where c ~* 'jefferson county public|jcps') jcps,
  count(*) filter (where c ~* 'louisville metro') metro_gov, count(*) filter (where c ~* 'university of louisville') uofl,
  count(*) filter (where c ~* 'norton') norton, count(*) filter (where c ~* 'humana') humana,
  count(*) filter (where c ~* 'commonwealth of kentucky|state of kentucky') ky_state
from l;
