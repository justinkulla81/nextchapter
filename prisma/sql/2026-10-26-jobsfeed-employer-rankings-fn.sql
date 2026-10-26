-- Employer rankings for the monthly report, national (no arguments) or for one place. The filters are copied from
-- src/lib/seo/employer-rankings.ts (LIVE_PUBLIC_SQL, NOT_STAFFING, one role per crawlerFingerprint) so the report matches
-- https://launchyournextchapter.com/top-employers. Staffing and search firms are excluded.
create or replace function jobsfeed_employer_rankings(p_states text[] default null, p_cities text[] default null, p_rank int default 25, p_fn_rank int default 15)
returns jsonb language sql stable security definer set search_path = public as $fn$
with roles as (
  select distinct on (coalesce("crawlerFingerprint", "id")) "companyId", "companyName", "level", "postingSignals", "aiSkillGroups", "targetFunction"
  from "ExclusiveJobPosting"
  where "status" = 'approved' and "archivedAt" is null and "institutionScopeId" is null and "orgScopeId" is null
    and coalesce("distribution", '') = 'OPEN' and coalesce("disclosure", 'OPEN') = 'OPEN'
    and ("expiresAt" is null or "expiresAt" > now()) and coalesce("employmentType", '') not in ('internship', 'co_op', 'coop')
    and coalesce("postingType", '') <> 'recruiter_search' and coalesce("sourceCategory", '') <> 'search_firm'
    and (p_states is null or ("locationState" = any(p_states) and lower("locationCity") = any(p_cities)))
  order by coalesce("crawlerFingerprint", "id"), "lastVerifiedAt" desc nulls last, "createdAt" desc),
base as (
  select r.*, c.name cname from roles r left join "Company" c on c.id = r."companyId"
  where r."companyName" is not null and btrim(r."companyName") <> ''
    and c.industry is distinct from 'Staffing & Human Capital'
    and coalesce(c.name, r."companyName") !~* '(staffing|recruit|talent|\msearch\M|work at home|workforce solutions|headhunt)'
    and coalesce(c.name, r."companyName") !~* '^(confidential|company confidential|confidential company|remote|clients? blackbox|stealth.*|undisclosed|anonymous|various|multiple companies|hiring now|our client)$'),
emp as (
  select coalesce("companyId", lower("companyName")) k, coalesce(max(cname), max("companyName")) name, count(*)::int open,
    count(*) filter (where "level" in ('ENTRY_IC','EARLY_IC'))::int entry,
    count(*) filter (where "level" in ('ENTRY_IC','EARLY_IC') and 'no_experience_ok' = any("postingSignals"))::int no_exp,
    count(*) filter (where "level" in ('ENTRY_IC','EARLY_IC') and 'training_provided' = any("postingSignals"))::int training,
    count(*) filter (where cardinality("aiSkillGroups") > 0)::int ai_skill
  from base group by coalesce("companyId", lower("companyName"))),
per as (
  select coalesce("companyId", lower("companyName")) k, coalesce(max(cname), max("companyName")) name, "targetFunction" fn, count(*)::int open,
    count(*) filter (where "level" in ('ENTRY_IC','EARLY_IC'))::int entry
  from base where "targetFunction" is not null group by coalesce("companyId", lower("companyName")), "targetFunction"),
ranked as (select per.*, row_number() over (partition by fn order by open desc, name) rk, sum(open) over (partition by fn)::int fn_open from per)
select jsonb_build_object(
  'as_of', now(), 'scope', case when p_states is null then 'national' else 'place' end,
  'total_open', (select coalesce(sum(open), 0) from emp), 'total_entry', (select coalesce(sum(entry), 0) from emp),
  'entry', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (select name, open, entry, no_exp, training, ai_skill from emp where entry > 0 order by entry desc, open desc, name limit p_rank) x),
  'no_exp', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (select name, open, entry, no_exp, training, ai_skill from emp where no_exp > 0 order by no_exp desc, open desc, name limit p_rank) x),
  'ai_share', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (select name, open, ai_skill, round(100.0 * ai_skill / open, 0) share_pct from emp where open >= 25 and ai_skill > 0 order by ai_skill::numeric / open desc, ai_skill desc limit p_rank) x),
  'ai_count', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (select name, open, ai_skill from emp where ai_skill > 0 order by ai_skill desc, open desc, name limit p_rank) x),
  'functions', (select coalesce(jsonb_agg(jsonb_build_object('function', fn, 'open', fn_open, 'employers', emps) order by fn), '[]') from (
      select fn, max(fn_open) fn_open, jsonb_agg(jsonb_build_object('name', name, 'open', open, 'entry', entry) order by rk) emps from ranked where rk <= p_fn_rank group by fn) y)
);
$fn$;
revoke all on function jobsfeed_employer_rankings(text[], text[], int, int) from public, anon, authenticated;
