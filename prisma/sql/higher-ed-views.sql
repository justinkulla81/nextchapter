-- Higher Ed module V1 — HE-02 consent-applying views (spec §8).
--
-- Staff read candidate data ONLY through these views. Apply after every
-- `prisma db push` touching Higher Ed tables (idempotent; `npm run he:rls`
-- applies this file after higher-ed-rls.sql).
--
-- How the gates split:
--   - CONSENT is applied here, in SQL: a column a member hasn't agreed to
--     share comes back NULL, so no server code path can leak it by
--     forgetting a check.
--   - ROLE is applied by requireWorkspace() on the server, which then reads
--     these views through src/lib/higher-ed/views.ts. A view can't filter by
--     role itself on that path: Prisma connects as the table owner, where
--     auth.uid() is empty.
--   - The views live in the `private` schema, which the Supabase API does not
--     expose, so no browser client can query them directly.
--
-- Never selected by any view: assessment item responses, Bearing results,
-- coaching notes, email/calendar activity details, resume content. (v_member_ai_skills
-- carries derived skill keywords and the function label, never resume text, and only for
-- members whose SHARE_OUTCOME consent is on; the server returns counts only.) The only
-- candidate-authored text exposed is the approved Dossier positioning
-- statement, and only with SHARE_DOSSIER_WITH_EMPLOYERS on.

create schema if not exists private;

-- Dropped and recreated (not just "create or replace") so a column change
-- in a later step applies cleanly. Nothing outside this file depends on them.
drop view if exists private.v_member_ai_skills;
drop view if exists private.v_outcomes_by_bucket;
drop view if exists private.v_roi_inputs;
drop view if exists private.v_employer_dossiers;
drop view if exists private.v_caseload_activity;
drop view if exists private.v_member_transition;
drop view if exists private.v_member_directory;
drop view if exists private.v_member_engagement;
drop view if exists private.v_member_consent;

-- Current consent per member, with the §14 defaults when no row exists
-- (engagement and outcome on; search detail and Dossier off). Each scope is
-- a newest-row lookup on InstitutionConsent_memberId_scope_changedAt_idx.
create view private.v_member_consent as
select
  m.id as "memberId",
  m."institutionId",
  coalesce(ce.granted, true)  as "shareEngagement",
  coalesce(co.granted, true)  as "shareOutcome",
  coalesce(cs.granted, false) as "shareSearchDetail",
  coalesce(cd.granted, false) as "shareDossier"
from public."InstitutionMember" m
left join lateral (
  select c.granted from public."InstitutionConsent" c
  where c."memberId" = m.id and c.scope = 'SHARE_ENGAGEMENT'
  order by c."changedAt" desc, c."createdAt" desc limit 1
) ce on true
left join lateral (
  select c.granted from public."InstitutionConsent" c
  where c."memberId" = m.id and c.scope = 'SHARE_OUTCOME'
  order by c."changedAt" desc, c."createdAt" desc limit 1
) co on true
left join lateral (
  select c.granted from public."InstitutionConsent" c
  where c."memberId" = m.id and c.scope = 'SHARE_SEARCH_DETAIL_WITH_CAREER'
  order by c."changedAt" desc, c."createdAt" desc limit 1
) cs on true
left join lateral (
  select c.granted from public."InstitutionConsent" c
  where c."memberId" = m.id and c.scope = 'SHARE_DOSSIER_WITH_EMPLOYERS'
  order by c."changedAt" desc, c."createdAt" desc limit 1
) cd on true;

-- v_member_ai_skills — input to the counts-only "AI skills" panel on the Career Services
-- Outcomes tab (src/lib/skills/cohort-ai-gap.ts). One row per claimed member whose SHARE_OUTCOME
-- consent is on: the function label and the derived skill keywords the skills matrix reads.
-- The server turns these into counts and suppresses any group under 10 people; no row, name
-- or email reaches the page. Members without consent are absent, not NULL.
create view private.v_member_ai_skills as
select
  m.id as "memberId",
  m."institutionId",
  cp."primaryFunction",
  cp."resumeKeywords",
  cp."confirmedSkillsHave",
  cp.certifications,
  cp."skillLevels"
from public."InstitutionMember" m
join public."CandidateProfile" cp on cp.id = m."candidateId"
join private.v_member_consent mc on mc."memberId" = m.id and mc."shareOutcome";

-- v_member_engagement — the engagement score (spec §7): rolling 12 months,
-- the §7 caps (logins and outreach clicks 4 points a month, tool use 8 a
-- month, gifts 10 across the window), split into the CASE categories, and a
-- Low / Medium / High tier by percentile within the institution. Members who
-- turned engagement sharing off are left out entirely.
create view private.v_member_engagement as
-- Points per event: the college's own weight (Alumni Relations › Engagement,
-- enabledFeatures.engagementWeights, keyed by event type; the mentor's side
-- of a call is MENTOR_CALL_MENTOR), else the points stored at write time.
-- Weights apply to history too, so changing one re-scores the last 12 months.
with monthly as (
  select e."memberId", e."institutionId", e.type, e."caseCategory", date_trunc('month', e."occurredAt") as month,
    sum(coalesce(
      case when (i."enabledFeatures" -> 'engagementWeights' ->> (case when e.type = 'MENTOR_CALL' and e."caseCategory" = 'VOLUNTEER' then 'MENTOR_CALL_MENTOR' else e.type::text end)) ~ '^[0-9]{1,2}$'
        then (i."enabledFeatures" -> 'engagementWeights' ->> (case when e.type = 'MENTOR_CALL' and e."caseCategory" = 'VOLUNTEER' then 'MENTOR_CALL_MENTOR' else e.type::text end))::int end,
      e.points)) as pts
  from public."EngagementEvent" e
  join public."Institution" i on i.id = e."institutionId"
  where e."occurredAt" >= now() - interval '12 months'
  group by 1, 2, 3, 4, 5
), capped as (
  -- Monthly caps first, then summed over the 12 months.
  select "memberId", "institutionId", type, "caseCategory",
    sum(case type when 'LOGIN' then least(pts, 4) when 'OUTREACH_CLICK' then least(pts, 4) when 'TOOL_USE' then least(pts, 8) else pts end) as pts
  from monthly
  group by 1, 2, 3, 4
), per_member as (
  select "memberId", "institutionId",
    sum(case when type = 'GIFT' then least(pts, 10) else pts end)::int as score,
    sum(case when "caseCategory" = 'VOLUNTEER' then pts else 0 end)::int as volunteer,
    sum(case when "caseCategory" = 'EXPERIENTIAL' then pts else 0 end)::int as experiential,
    sum(case when "caseCategory" = 'PHILANTHROPIC' then least(pts, 10) else 0 end)::int as philanthropic,
    sum(case when "caseCategory" = 'COMMUNICATION' then pts else 0 end)::int as communication
  from capped
  group by 1, 2
)
-- Every member who shares engagement, scored or not: ranked against the
-- whole sharing roster, so a zero is always Low and a lone active alum is High.
select mc."memberId", mc."institutionId",
  coalesce(pm.score, 0) as score,
  coalesce(pm.volunteer, 0) as volunteer,
  coalesce(pm.experiential, 0) as experiential,
  coalesce(pm.philanthropic, 0) as philanthropic,
  coalesce(pm.communication, 0) as communication,
  case
    when coalesce(pm.score, 0) = 0 then 'Low'
    when percent_rank() over (partition by mc."institutionId" order by coalesce(pm.score, 0)) >= 0.67 then 'High'
    when percent_rank() over (partition by mc."institutionId" order by coalesce(pm.score, 0)) >= 0.33 then 'Medium'
    else 'Low'
  end as tier
from private.v_member_consent mc
left join per_member pm on pm."memberId" = mc."memberId"
where mc."shareEngagement";

-- v_member_directory — any staff role.
-- employer/title: only with SHARE_OUTCOME. NextChapter's current employment
-- record wins over the roster's last-known values when there is one.
-- engagementPoints12mo: only with SHARE_ENGAGEMENT (HE-07 turns this into
-- the Low/Medium/High tier).
create view private.v_member_directory as
select
  m.id as "memberId",
  m."institutionId",
  m."firstName",
  m."lastName",
  m."classYear",
  m.affiliation,
  m.status,
  m."doNotContact",
  mc."shareOutcome",
  mc."shareEngagement",
  case when mc."shareOutcome" then coalesce(emp."companyName", m."lastKnownEmployer") end as employer,
  case when mc."shareOutcome" then coalesce(emp.title, m."lastKnownTitle") end as title,
  case when mc."shareEngagement" then coalesce(eng.score, 0) end as "engagementPoints12mo",
  case when mc."shareEngagement" then coalesce(eng.tier, 'Low') end as "engagementTier"
from public."InstitutionMember" m
join private.v_member_consent mc on mc."memberId" = m.id
left join lateral (
  select co.name as "companyName", me.title
  from public."MemberEmployment" me
  join public."Company" co on co.id = me."companyId"
  where me."candidateId" = m."candidateId" and me."isCurrent"
  order by me."startDate" desc nulls last
  limit 1
) emp on m."candidateId" is not null
left join private.v_member_engagement eng on eng."memberId" = m.id;

-- v_member_transition — DEVELOPMENT, ALUMNI_RELATIONS, CAREER_SERVICES
-- (and INSTITUTION_ADMIN). Open flags only. Never the reason or the source.
create view private.v_member_transition as
select
  f.id as "flagId",
  m.id as "memberId",
  m."institutionId",
  m."firstName",
  m."lastName",
  m."classYear",
  f.state,
  f."doNotSolicit",
  f."startedAt" as since,
  f."graceEndsAt"
from public."TransitionFlag" f
join public."InstitutionMember" m on m.id = f."memberId"
where f.state <> 'CLEARED';

-- v_caseload_activity — the assigned counselor (and INSTITUTION_ADMIN).
-- Search detail (last activity, sprint, coaching dates) only with
-- SHARE_SEARCH_DETAIL_WITH_CAREER; otherwise NULL. The next check-in is the
-- college's own schedule, so it always shows.
create view private.v_caseload_activity as
select
  a.id as "assignmentId",
  a."institutionId",
  a."counselorId",
  m.id as "memberId",
  m."firstName",
  m."lastName",
  m."classYear",
  m.affiliation,
  mc."shareSearchDetail",
  case when mc."shareSearchDetail" then act."lastActivityAt" end as "lastActivityAt",
  case when mc."shareSearchDetail" then sp."weekStartDate" end as "sprintWeekStart",
  case when mc."shareSearchDetail" then sp.total end as "sprintActionsTotal",
  case when mc."shareSearchDetail" then sp.done end as "sprintActionsDone",
  case when mc."shareSearchDetail" then cs."lastCoachingAt" end as "lastCoachingAt",
  -- The member's journey and stage (src/lib/journey) are search detail too.
  case when mc."shareSearchDetail" then cp.journey::text end as journey,
  case when mc."shareSearchDetail" then cp."journeyStage"::text end as "journeyStage",
  ci."nextCheckInAt",
  ci."nextCheckInKind"
from public."CaseloadAssignment" a
join public."InstitutionMember" m on m.id = a."memberId"
join private.v_member_consent mc on mc."memberId" = m.id
left join public."CandidateProfile" cp on cp.id = m."candidateId"
left join lateral (
  select max(l."createdAt") as "lastActivityAt"
  from public."CandidateLoginEvent" l
  where l."candidateId" = m."candidateId"
) act on m."candidateId" is not null
left join lateral (
  select
    w."weekStartDate",
    jsonb_array_length(w."committedActions") as total,
    (select count(*)::int from jsonb_array_elements(w."committedActions") x
      where (x ->> 'completed')::boolean) as done
  from public."WeeklySprint" w
  where w."candidateId" = m."candidateId" and jsonb_typeof(w."committedActions") = 'array'
  order by w."weekStartDate" desc
  limit 1
) sp on m."candidateId" is not null
left join lateral (
  select max(s."occurredAt") as "lastCoachingAt"
  from public."CoachSession" s
  where s."candidateId" = m."candidateId"
) cs on m."candidateId" is not null
left join lateral (
  select c."dueAt" as "nextCheckInAt", c.kind as "nextCheckInKind"
  from public."CheckIn" c
  where c."memberId" = m.id and c.status = 'SCHEDULED'
  order by c."dueAt"
  limit 1
) ci on true
where a."endedAt" is null;

-- v_employer_dossiers — approved employer seats. Only members who turned
-- SHARE_DOSSIER_WITH_EMPLOYERS on and have claimed an account. The summary
-- is the positioning statement the candidate approved (never the draft).
create view private.v_employer_dossiers as
select
  m.id as "memberId",
  m."institutionId",
  m."firstName",
  m."lastName",
  m."classYear",
  m.degree,
  m.major,
  cp."positioningStatementText" as "dossierSummary"
from public."InstitutionMember" m
join private.v_member_consent mc on mc."memberId" = m.id and mc."shareDossier"
join public."CandidateProfile" cp on cp.id = m."candidateId";

-- v_roi_inputs — DEVELOPMENT, INSTITUTION_ADMIN. Aggregates only; never a
-- member row. HE-10 builds the §7 fiscal-year metrics on top of this.
create view private.v_roi_inputs as
select
  i.id as "institutionId",
  (select count(*)::int from public."InstitutionMember" m where m."institutionId" = i.id) as "memberCount",
  (select count(*)::int from public."InstitutionMember" m
    where m."institutionId" = i.id and m.status in ('CLAIMED', 'ACTIVE')) as "claimedCount",
  (select count(*)::int from public."InstitutionMember" m
    where m."institutionId" = i.id and m."isActiveSeat") as "activeSeatCount",
  (select count(*)::int from public."TransitionFlag" f
    join public."InstitutionMember" m on m.id = f."memberId"
    where m."institutionId" = i.id and f.state <> 'CLEARED') as "openFlagCount",
  (select count(*)::int from public."InstitutionGift" g where g."institutionId" = i.id) as "giftCount",
  (select coalesce(sum(g."amountCents"), 0)::bigint from public."InstitutionGift" g where g."institutionId" = i.id) as "giftCents",
  (select max(r."completedAt") from public."CrmExchangeRun" r
    where r."institutionId" = i.id and r.direction = 'IMPORT_GIFTS' and r.status in ('SUCCEEDED', 'PARTIAL')) as "lastGiftImportAt"
from public."Institution" i;

-- v_outcomes_by_bucket — CAREER_SERVICES, INSTITUTION_ADMIN, DEVELOPMENT.
-- Aggregates only, one row per (institution, unemployment-duration bucket);
-- never a member row. Only members whose SHARE_OUTCOME consent is on are
-- counted (consent applied here, in SQL). The server suppresses any cell with
-- fewer than 10 people (src/lib/outcomes/small-cell.ts).
--
-- Exposure model: a member is "at risk" from the week they joined (weeks
-- since their last job at claim) until the week they were re-employed in a
-- PERMANENT role, or until now. Person-weeks in a bucket let the server
-- compare actual re-employment with the public benchmark for that same
-- bucket, which removes the adverse-selection penalty of enrolling people
-- who have already searched a long time. Interim, fractional and advisory
-- work is counted separately and is never treated as a permanent hire.
create view private.v_outcomes_by_bucket as
with buckets(bucket, lo, hi) as (
  values ('W0_4'::text, 0, 5), ('W5_13', 5, 14), ('W14_26', 14, 27), ('W27_52', 27, 53), ('W53_PLUS', 53, 100000)
),
cohort as (
  select
    m.id as member_id,
    m."institutionId",
    coalesce(m."claimedAt", m."createdAt") as joined_at,
    cp."lastJobEndedAt",
    (select min(h."hiredAt") from public."HireOutcome" h
       where h."candidateId" = cp.id and h."outcomeType" = 'PERMANENT') as perm_hired_at
  from public."InstitutionMember" m
  join public."CandidateProfile" cp on cp.id = m."candidateId"
  join private.v_member_consent mc on mc."memberId" = m.id and mc."shareOutcome"
  where cp."lastJobEndedAt" is not null
),
cohort_wk as (
  select c.member_id, c."institutionId",
    greatest(0, floor(extract(epoch from (c.joined_at - c."lastJobEndedAt")) / 604800))::int as start_wk,
    (c.perm_hired_at is not null and c.perm_hired_at >= c.joined_at) as hired_in_window,
    case when c.perm_hired_at is not null and c.perm_hired_at >= c.joined_at
         then floor(extract(epoch from (c.perm_hired_at - c."lastJobEndedAt")) / 604800)::int
         else floor(extract(epoch from (now() - c."lastJobEndedAt")) / 604800)::int end as end_wk
  from cohort c
),
exposure as (
  select
    cw."institutionId", b.bucket,
    count(*) filter (where least(cw.end_wk, b.hi) - greatest(cw.start_wk, b.lo) > 0)::int as members,
    coalesce(sum(greatest(0, least(cw.end_wk, b.hi) - greatest(cw.start_wk, b.lo))), 0)::int as person_weeks,
    count(*) filter (where cw.hired_in_window and cw.end_wk >= b.lo and cw.end_wk < b.hi)::int as reemployed
  from cohort_wk cw cross join buckets b
  group by cw."institutionId", b.bucket
),
hires as (
  select
    m."institutionId",
    coalesce(h."enrollmentBucket"::text, 'UNKNOWN') as bucket,
    count(*)::int as hires_all,
    count(*) filter (where h."outcomeType" in ('INTERIM', 'FRACTIONAL', 'ADVISORY'))::int as interim_hires,
    count(*) filter (where h.source in ('REFERRAL', 'NETWORK_CONVERSATION', 'ALUMNI_OR_MENTOR'))::int as warm_sourced,
    count(*) filter (where h."priorBasePayUsd" > 0 and h."newBasePayUsd" > 0)::int as with_pay,
    count(*) filter (where h."priorBasePayUsd" > 0 and h."newBasePayUsd" > 0 and h."newBasePayUsd" < h."priorBasePayUsd")::int as took_cut,
    percentile_cont(0.5) within group (order by h."newBasePayUsd"::float8 / h."priorBasePayUsd")
      filter (where h."priorBasePayUsd" > 0 and h."newBasePayUsd" > 0) as median_pay_retention
  from public."HireOutcome" h
  join public."InstitutionMember" m on m."candidateId" = h."candidateId"
  join private.v_member_consent mc on mc."memberId" = m.id and mc."shareOutcome"
  group by m."institutionId", coalesce(h."enrollmentBucket"::text, 'UNKNOWN')
)
select
  coalesce(e."institutionId", h."institutionId") as "institutionId",
  coalesce(e.bucket, h.bucket) as bucket,
  coalesce(e.members, 0) as "members",
  coalesce(e.person_weeks, 0) as "personWeeks",
  coalesce(e.reemployed, 0) as "reemployed",
  coalesce(h.hires_all, 0) as "hiresAll",
  coalesce(h.interim_hires, 0) as "interimHires",
  coalesce(h.warm_sourced, 0) as "warmSourced",
  coalesce(h.with_pay, 0) as "withPay",
  coalesce(h.took_cut, 0) as "tookCut",
  h.median_pay_retention as "medianPayRetention"
from exposure e
full join hires h on h."institutionId" = e."institutionId" and h.bucket = e.bucket;

-- Server-only: no API role may read these, even though `authenticated` has
-- USAGE on the schema for the RLS helper functions.
revoke all on all tables in schema private from public, anon, authenticated;
