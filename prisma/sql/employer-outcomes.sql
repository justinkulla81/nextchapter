-- Employer scorecard: duration-adjusted re-employment, aggregates only.
--
-- Applied by `npm run he:rls` after higher-ed-views.sql. Idempotent.
--
-- Privacy design (see docs/EMPLOYER_SCORECARD_PRIVACY_REVIEW.md):
--   - Returns at most five rows (one per duration bucket) of counts. It never
--     returns a person, an id, a date or a pay figure.
--   - A person counts only if ALL hold: their seat opted in to sharing outcome
--     counts with the employer (OutplacementSeat.shareOutcomeWithEmployer),
--     they are NOT in Confidential Search Mode, and they are not themselves a
--     user of the same employer organization (an org user never sees their own
--     record from the org side, spec A1.2.4). Excluded people are removed from
--     numerator and denominator, with no trace in any count.
--   - p_as_of lets the caller snap small cohorts to the last complete quarter
--     (spec A1.3); nothing after p_as_of is counted.
--   - Small-cell suppression, merging, rounding and banding are applied by the
--     caller (src/lib/employer/outcome-scorecard.ts), never skipped.
create schema if not exists private;

drop function if exists private.employer_outcomes_by_bucket(text, timestamptz);

create function private.employer_outcomes_by_bucket(p_contract_id text, p_as_of timestamptz)
returns table (bucket text, enrolled int, person_weeks int, reemployed int)
language sql
stable
set search_path = ''
as $$
  with buckets(bucket, lo, hi) as (
    values ('W0_4'::text, 0, 5), ('W5_13', 5, 14), ('W14_26', 14, 27), ('W27_52', 27, 53), ('W53_PLUS', 53, 100000)
  ),
  pop as (
    select
      cp.id as cp_id,
      cp."lastJobEndedAt" as last_job,
      coalesce(os."activatedAt", os."enrolledAt") as joined_at,
      (select min(h."hiredAt") from public."HireOutcome" h
         where h."candidateId" = cp.id and h."outcomeType" = 'PERMANENT' and h."hiredAt" <= p_as_of) as perm_hired_at
    from public."OutplacementSeat" os
    join public."OutplacementContract" oc on oc.id = os."contractId"
    join public."CandidateProfile" cp on cp.id = os."candidateId"
    where os."contractId" = p_contract_id
      and os.status in ('ACTIVATED', 'DEACTIVATED')
      and os."shareOutcomeWithEmployer" is true
      and cp."confidentialSearchMode" is false
      and cp."lastJobEndedAt" is not null
      and cp."lastJobEndedAt" <= p_as_of
      and coalesce(os."activatedAt", os."enrolledAt") <= p_as_of
      and not exists (
        select 1 from public."OutplacementOrgUser" ou
        where ou."orgId" = oc."orgId" and ou."userId" is not null and ou."userId" = cp."userId"
      )
  ),
  wk as (
    select
      greatest(0, floor(extract(epoch from (p.joined_at - p.last_job)) / 604800))::int as start_wk,
      (p.perm_hired_at is not null and p.perm_hired_at >= p.joined_at) as hired_in_window,
      case when p.perm_hired_at is not null and p.perm_hired_at >= p.joined_at
           then floor(extract(epoch from (p.perm_hired_at - p.last_job)) / 604800)::int
           else floor(extract(epoch from (p_as_of - p.last_job)) / 604800)::int end as end_wk
    from pop p
  )
  select
    b.bucket,
    -- enrolled: people whose search stage when they joined falls in this bucket.
    -- Each person is counted in exactly one bucket, so enrolled values add up to
    -- the real headcount and merged cells can be sized correctly.
    (count(*) filter (where w.start_wk >= b.lo and w.start_wk < b.hi))::int as enrolled,
    (coalesce(sum(greatest(0, least(w.end_wk, b.hi) - greatest(w.start_wk, b.lo))), 0))::int as person_weeks,
    (count(*) filter (where w.hired_in_window and w.end_wk >= b.lo and w.end_wk < b.hi))::int as reemployed
  from wk w cross join buckets b
  group by b.bucket
  order by b.bucket;
$$;

revoke all on function private.employer_outcomes_by_bucket(text, timestamptz) from public, anon, authenticated;
