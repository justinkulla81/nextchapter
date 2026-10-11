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
-- coaching notes, email/calendar activity details, resume content. The only
-- candidate-authored text exposed is the approved Dossier positioning
-- statement, and only with SHARE_DOSSIER_WITH_EMPLOYERS on.

create schema if not exists private;

-- Dropped and recreated (not just "create or replace") so a column change
-- in a later step applies cleanly. Nothing outside this file depends on them.
drop view if exists private.v_roi_inputs;
drop view if exists private.v_employer_dossiers;
drop view if exists private.v_caseload_activity;
drop view if exists private.v_member_transition;
drop view if exists private.v_member_directory;
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
  case when mc."shareEngagement" then coalesce(eng.points, 0) end as "engagementPoints12mo"
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
left join lateral (
  select sum(e.points)::int as points
  from public."EngagementEvent" e
  where e."memberId" = m.id and e."occurredAt" >= now() - interval '12 months'
) eng on true;

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
  ci."nextCheckInAt",
  ci."nextCheckInKind"
from public."CaseloadAssignment" a
join public."InstitutionMember" m on m.id = a."memberId"
join private.v_member_consent mc on mc."memberId" = m.id
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

-- Server-only: no API role may read these, even though `authenticated` has
-- USAGE on the schema for the RLS helper functions.
revoke all on all tables in schema private from public, anon, authenticated;
