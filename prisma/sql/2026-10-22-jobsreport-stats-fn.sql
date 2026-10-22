-- One RPC that returns every number a geo report needs, so no edge function or pasted SQL is required.
create or replace function jobsreport_stats(p_geo text)
returns jsonb language sql stable security definer set search_path = public as $fn$
with a as (select * from jobsreport_posting where geo = p_geo and county_fips is not null),
w as (select *, lower(coalesce(description,'')) d from a where white_collar),
t as (select *, (d ~ '\m(artificial intelligence|machine learning|generative ai|genai|llm|large language model|copilot|chatgpt|ai[- ]powered|ai tools?)\M' or d ~ '(^|[^a-z])ai([^a-z]|$)') ai from w)
select jsonb_build_object(
 'geo', p_geo,
 'overview', (select jsonb_build_object('postings', count(*), 'white_collar', count(*) filter (where white_collar),
     'unclassified', count(*) filter (where white_collar is null), 'employers', count(distinct employer),
     'in_county', count(*), 'wc_in_county', count(*) filter (where white_collar)) from a),
 'levels', (select coalesce(jsonb_agg(jsonb_build_object('level', level, 'n', n) order by n desc), '[]') from (select level, count(*) n from w group by 1) x),
 'functions', (select coalesce(jsonb_agg(jsonb_build_object('function', function, 'n', n, 'entry', entry, 'employers', employers, 'median_pay', median_pay) order by n desc), '[]') from (
     select function, count(*) n, count(*) filter (where level='ENTRY') entry, count(distinct employer) employers,
       (percentile_cont(0.5) within group (order by (pay_min+coalesce(pay_max,pay_min))/2) filter (where pay_period='year' and pay_min between 20000 and 1000000))::int median_pay
     from w group by 1) x),
 'employers', (select coalesce(jsonb_agg(jsonb_build_object('employer', employer, 'source_type', source_type, 'n', n, 'wc', wc, 'wc_entry', wc_entry) order by n desc), '[]') from (
     select employer, source_type, count(*) n, count(*) filter (where white_collar) wc, count(*) filter (where white_collar and level='ENTRY') wc_entry
     from a group by 1,2 order by 3 desc limit 40) x),
 'signals', (select jsonb_build_object('n', count(*),
     'ai_pct', round(100.0*count(*) filter (where ai)/nullif(count(*),0),1),
     'remote_mention_pct', round(100.0*count(*) filter (where d ~ '\mremote\M' or arrangement='remote')/nullif(count(*),0),1),
     'hybrid_mention_pct', round(100.0*count(*) filter (where d ~ '\mhybrid\M' or arrangement='hybrid')/nullif(count(*),0),1),
     'part_time_pct', round(100.0*count(*) filter (where employment_type ilike '%part%')/nullif(count(*),0),1),
     'contract_words_pct', round(100.0*count(*) filter (where d ~ '\m(contract|contractor|1099|temporary|temp-to-hire|fractional|interim|freelance)\M')/nullif(count(*),0),1),
     'pay_stated_pct', round(100.0*count(*) filter (where pay_min is not null)/nullif(count(*),0),1),
     'median_annual_pay', (percentile_cont(0.5) within group (order by (pay_min+coalesce(pay_max,pay_min))/2) filter (where pay_period='year' and pay_min between 20000 and 1000000))::int,
     'median_hourly_pay', (percentile_cont(0.5) within group (order by (pay_min+coalesce(pay_max,pay_min))/2) filter (where pay_period='hour' and pay_min between 8 and 300))::numeric(8,2),
     'dated', count(*) filter (where posted_at is not null),
     'older_than_90d_pct', round(100.0*count(*) filter (where posted_at < now()-interval '90 days')/nullif(count(*) filter (where posted_at is not null),0),1)) from t),
 'aiVs', (select coalesce(jsonb_agg(jsonb_build_object('ai', ai, 'n', n, 'median_pay', median_pay, 'senior_plus_pct', senior_plus_pct, 'remote_or_hybrid_pct', rh) order by ai desc), '[]') from (
     select ai, count(*) n,
       (percentile_cont(0.5) within group (order by (pay_min+coalesce(pay_max,pay_min))/2) filter (where pay_period='year' and pay_min between 20000 and 1000000))::int median_pay,
       round(100.0*count(*) filter (where level in ('SENIOR_IC','MANAGER','DIRECTOR','VP_PLUS'))/count(*),1) senior_plus_pct,
       round(100.0*count(*) filter (where d ~ '\m(remote|hybrid)\M')/count(*),1) rh from t group by ai) x),
 'eq', (select coalesce(jsonb_agg(jsonb_build_object('skill', skill, 'n', n) order by n desc), '[]') from (
     select skill, count(*) n from (
       select unnest(array_remove(array[
        case when d ~ 'communicat' then 'communication' end,
        case when d ~ '\m(collaborat\w*|teamwork|team player|cross-functional)\M' then 'collaboration' end,
        case when d ~ '\mleadership\M' then 'leadership' end,
        case when d ~ '\m(problem[- ]solving|critical thinking)\M' then 'problem solving' end,
        case when d ~ '\m(adaptab\w+|flexib\w+)\M' then 'adaptability' end,
        case when d ~ '\m(empath\w+|emotional intelligence|compassion\w*)\M' then 'empathy' end,
        case when d ~ '\mcreativ\w+' then 'creativity' end,
        case when d ~ '\m(sql|python|excel|tableau|power bi|sap|salesforce|epic)\M' then 'named tools' end], null)) skill from w) s group by 1) x),
 'crawl', (select jsonb_build_object('first_crawl', min(first_seen)::date, 'last_crawl', max(last_seen)::date, 'runs', count(distinct last_run_id)) from jobsreport_posting where geo = p_geo)
);
$fn$;
revoke all on function jobsreport_stats(text) from public, anon, authenticated;
