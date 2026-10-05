-- Higher Ed module V1 — HE-01 row-level security.
--
-- Prisma can't express RLS, so this file holds it. Apply it after every
-- `prisma db push` that touches the Higher Ed tables (it is idempotent):
--
--   npm run he:rls
--
-- Context: every public table in this database already has RLS on with no
-- policies, so the anon and authenticated roles can read nothing directly.
-- The app reads through Prisma as the table owner, which bypasses RLS. These
-- policies are defense in depth for any direct Supabase client read; the
-- real gate is requireWorkspace() on the server (HE-02).
--
-- Rules (spec §8):
--   - Tables with institutionId: readable by that institution's active
--     staff (accepted, not revoked InstitutionUser) or nc_admin.
--   - InstitutionMember: also readable by the member themselves.
--   - Candidate-owned rows (consent, transition flags, outcome reports,
--     check-ins): the member, plus an assigned Career Services counselor
--     where the spec allows. Other staff read them only through the HE-02
--     consent views, never directly.
--   - InstitutionConsent writes: the member only.
--   - TransitionFlag writes: the member or an assigned CAREER_SERVICES
--     counselor (system jobs run through Prisma).
--   - anon: nothing.
--
-- Helper functions live in the `private` schema, which PostgREST doesn't
-- expose, and are SECURITY DEFINER so a policy can look up roles without
-- recursing into these same policies.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.he_uid() returns text
language sql stable
set search_path = ''
as $$ select (select auth.uid())::text $$;

create or replace function private.he_is_nc_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."RoleGrant" g
    where g."userId" = private.he_uid()
      and g.role = 'nc_admin'
      and g."revokedAt" is null
  )
$$;

-- Any active staff role at this institution.
create or replace function private.he_is_staff(p_institution_id text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."InstitutionUser" u
    where u."institutionId" = p_institution_id
      and u."userId" = private.he_uid()
      and u."acceptedAt" is not null
      and u."revokedAt" is null
  )
$$;

-- One of the given staff roles at this institution.
create or replace function private.he_has_role(p_institution_id text, p_roles text[]) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."InstitutionUser" u
    where u."institutionId" = p_institution_id
      and u."userId" = private.he_uid()
      and u."acceptedAt" is not null
      and u."revokedAt" is null
      and u.role::text = any (p_roles)
  )
$$;

-- This InstitutionMember row belongs to the signed-in candidate.
create or replace function private.he_is_my_member(p_member_id text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."InstitutionMember" m
    join public."CandidateProfile" c on c.id = m."candidateId"
    where m.id = p_member_id
      and c."userId" = private.he_uid()
  )
$$;

-- The signed-in candidate is a member of this institution.
create or replace function private.he_is_institution_member(p_institution_id text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."InstitutionMember" m
    join public."CandidateProfile" c on c.id = m."candidateId"
    where m."institutionId" = p_institution_id
      and c."userId" = private.he_uid()
  )
$$;

create or replace function private.he_member_institution(p_member_id text) returns text
language sql stable security definer
set search_path = ''
as $$ select m."institutionId" from public."InstitutionMember" m where m.id = p_member_id $$;

-- The signed-in user is a CAREER_SERVICES counselor with an open caseload
-- assignment for this member.
create or replace function private.he_is_assigned_counselor(p_member_id text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."CaseloadAssignment" a
    join public."InstitutionUser" u on u.id = a."counselorId"
    where a."memberId" = p_member_id
      and a."endedAt" is null
      and u."userId" = private.he_uid()
      and u.role = 'CAREER_SERVICES'
      and u."acceptedAt" is not null
      and u."revokedAt" is null
  )
$$;

-- The signed-in user owns this EmployerProfile or holds an accepted seat on it.
create or replace function private.he_is_employer_user(p_employer_profile_id text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."EmployerProfile" e
    where e.id = p_employer_profile_id and e."userId" = private.he_uid()
  ) or exists (
    select 1 from public."EmployerSeat" s
    where s."employerId" = p_employer_profile_id
      and s."userId" = private.he_uid()
      and s."acceptedAt" is not null
  )
$$;

create or replace function private.he_campaign_institution(p_campaign_id text) returns text
language sql stable security definer
set search_path = ''
as $$ select c."institutionId" from public."OutreachCampaign" c where c.id = p_campaign_id $$;

create or replace function private.he_mentor_institution(p_mentor_id text) returns text
language sql stable security definer
set search_path = ''
as $$ select m."institutionId" from public."InstitutionMentor" m where m.id = p_mentor_id $$;

create or replace function private.he_mentor_member(p_mentor_id text) returns text
language sql stable security definer
set search_path = ''
as $$ select m."memberId" from public."InstitutionMentor" m where m.id = p_mentor_id $$;

create or replace function private.he_fund_institution(p_fund_id text) returns text
language sql stable security definer
set search_path = ''
as $$ select f."institutionId" from public."ResilienceFund" f where f.id = p_fund_id $$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ── Enable RLS on every Higher Ed table ────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'Institution', 'InstitutionUser', 'InstitutionMember', 'InstitutionConsent',
    'TransitionFlag', 'LayoffMatch', 'OutreachCampaign', 'OutreachSend',
    'EngagementEvent', 'InstitutionMentor', 'MentorRequest', 'InstitutionGift',
    'CrmExchangeRun', 'OutcomeReport', 'ProspectFlag', 'ResilienceFund',
    'FundAward', 'CaseloadAssignment', 'CheckIn', 'InstitutionEmployer',
    'InstitutionPurchase'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Supabase anonymous sign-ins also get the `authenticated` role. This
    -- restrictive policy is ANDed with every permissive one below, so an
    -- anonymous session can never read or write these tables.
    execute format('drop policy if exists he_no_anonymous on public.%I', t);
    execute format(
      'create policy he_no_anonymous on public.%I as restrictive for all to authenticated '
      'using (not coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false)) '
      'with check (not coalesce(((select auth.jwt()) ->> ''is_anonymous'')::boolean, false))',
      t
    );
  end loop;
end $$;

-- ── Policies ───────────────────────────────────────────────────────────────
-- Each policy is dropped and recreated so this file can be rerun.

-- Institution: staff, its members (branding), employers linked to it, nc_admin.
drop policy if exists he_select on public."Institution";
create policy he_select on public."Institution" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff(id)
  or private.he_is_institution_member(id)
  or exists (
    select 1 from public."InstitutionEmployer" ie
    where ie."institutionId" = "Institution".id
      and ie.status = 'APPROVED'
      and private.he_is_employer_user(ie."employerProfileId")
  )
);

-- InstitutionUser: staff of the institution, the user's own rows, nc_admin.
drop policy if exists he_select on public."InstitutionUser";
create policy he_select on public."InstitutionUser" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff("institutionId")
  or "userId" = private.he_uid()
);

-- InstitutionMember: staff, the member themselves, nc_admin.
drop policy if exists he_select on public."InstitutionMember";
create policy he_select on public."InstitutionMember" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff("institutionId")
  or private.he_is_my_member(id)
);

-- InstitutionConsent: the member reads and writes their own; append-only
-- (no update or delete policy). Staff read consent only through HE-02 views.
drop policy if exists he_select on public."InstitutionConsent";
create policy he_select on public."InstitutionConsent" for select to authenticated using (
  private.he_is_nc_admin() or private.he_is_my_member("memberId")
);
drop policy if exists he_insert_self on public."InstitutionConsent";
create policy he_insert_self on public."InstitutionConsent" for insert to authenticated with check (
  private.he_is_my_member("memberId")
);

-- TransitionFlag: the member or an assigned CAREER_SERVICES counselor reads
-- and writes. Development and Alumni Relations read only through
-- v_member_transition (HE-02), which never exposes reason or source.
drop policy if exists he_select on public."TransitionFlag";
create policy he_select on public."TransitionFlag" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_my_member("memberId")
  or private.he_is_assigned_counselor("memberId")
);
drop policy if exists he_insert on public."TransitionFlag";
create policy he_insert on public."TransitionFlag" for insert to authenticated with check (
  private.he_is_my_member("memberId") or private.he_is_assigned_counselor("memberId")
);
drop policy if exists he_update on public."TransitionFlag";
create policy he_update on public."TransitionFlag" for update to authenticated
  using (private.he_is_my_member("memberId") or private.he_is_assigned_counselor("memberId"))
  with check (private.he_is_my_member("memberId") or private.he_is_assigned_counselor("memberId"));

-- Staff-only institution tables.
drop policy if exists he_select on public."LayoffMatch";
create policy he_select on public."LayoffMatch" for select to authenticated using (
  private.he_is_nc_admin() or private.he_is_staff("institutionId")
);

drop policy if exists he_select on public."OutreachCampaign";
create policy he_select on public."OutreachCampaign" for select to authenticated using (
  private.he_is_nc_admin() or private.he_is_staff("institutionId")
);

drop policy if exists he_select on public."InstitutionGift";
create policy he_select on public."InstitutionGift" for select to authenticated using (
  private.he_is_nc_admin() or private.he_is_staff("institutionId")
);

drop policy if exists he_select on public."CrmExchangeRun";
create policy he_select on public."CrmExchangeRun" for select to authenticated using (
  private.he_is_nc_admin() or private.he_is_staff("institutionId")
);

drop policy if exists he_select on public."ProspectFlag";
create policy he_select on public."ProspectFlag" for select to authenticated using (
  private.he_is_nc_admin() or private.he_is_staff("institutionId")
);

-- OutreachSend: staff of the campaign's institution, the recipient member.
drop policy if exists he_select on public."OutreachSend";
create policy he_select on public."OutreachSend" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff(private.he_campaign_institution("campaignId"))
  or ("memberId" is not null and private.he_is_my_member("memberId"))
);

-- EngagementEvent: staff, the member.
drop policy if exists he_select on public."EngagementEvent";
create policy he_select on public."EngagementEvent" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff("institutionId")
  or private.he_is_my_member("memberId")
);

-- InstitutionMentor: staff, the mentor, and members of the same institution
-- browsing active mentors.
drop policy if exists he_select on public."InstitutionMentor";
create policy he_select on public."InstitutionMentor" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff("institutionId")
  or private.he_is_my_member("memberId")
  or ("isActive" and private.he_is_institution_member("institutionId"))
);

-- MentorRequest: staff, the requester, the mentor.
drop policy if exists he_select on public."MentorRequest";
create policy he_select on public."MentorRequest" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff(private.he_mentor_institution("mentorId"))
  or private.he_is_my_member("requesterMemberId")
  or private.he_is_my_member(private.he_mentor_member("mentorId"))
);

-- OutcomeReport: candidate-owned. The member and nc_admin only; staff read
-- outcomes through consent-gated views.
drop policy if exists he_select on public."OutcomeReport";
create policy he_select on public."OutcomeReport" for select to authenticated using (
  private.he_is_nc_admin() or private.he_is_my_member("memberId")
);

-- ResilienceFund: staff; members see active funds.
drop policy if exists he_select on public."ResilienceFund";
create policy he_select on public."ResilienceFund" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff("institutionId")
  or ("isActive" and private.he_is_institution_member("institutionId"))
);

-- FundAward: staff of the fund's institution, the awarded member.
drop policy if exists he_select on public."FundAward";
create policy he_select on public."FundAward" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff(private.he_fund_institution("fundId"))
  or private.he_is_my_member("memberId")
);

-- CaseloadAssignment: the counselor's own rows; INSTITUTION_ADMIN sees all.
drop policy if exists he_select on public."CaseloadAssignment";
create policy he_select on public."CaseloadAssignment" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_has_role("institutionId", array['INSTITUTION_ADMIN'])
  or exists (
    select 1 from public."InstitutionUser" u
    where u.id = "CaseloadAssignment"."counselorId"
      and u."userId" = private.he_uid()
      and u."revokedAt" is null
  )
);

-- CheckIn: the member, the assigned counselor.
drop policy if exists he_select on public."CheckIn";
create policy he_select on public."CheckIn" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_my_member("memberId")
  or private.he_is_assigned_counselor("memberId")
);

-- InstitutionEmployer: staff, and the employer's own users.
drop policy if exists he_select on public."InstitutionEmployer";
create policy he_select on public."InstitutionEmployer" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff("institutionId")
  or private.he_is_employer_user("employerProfileId")
);

-- InstitutionPurchase: staff (revenue-share report), the buyer.
drop policy if exists he_select on public."InstitutionPurchase";
create policy he_select on public."InstitutionPurchase" for select to authenticated using (
  private.he_is_nc_admin()
  or private.he_is_staff("institutionId")
  or private.he_is_my_member("memberId")
);
