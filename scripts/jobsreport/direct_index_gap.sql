-- Direct-jobs-to-Google gap report. Run against production from a session or the Supabase SQL editor; keep the result, do not loop it.
--
-- Cost: a 10% block sample of ExclusiveJobPosting (about 57,000 of 573,000 live rows), three narrow columns plus description length.
-- Do not widen it to the whole table (CLAUDE.md, "Database egress"): a whole-board aggregate ran 14-18 s and touched ~35 GB of buffers.
-- Counts are the sample's, times 10 for the estimate. A company shows only when the sample holds 8+ of its gap rows (about 80 jobs).
-- Rules mirror src/lib/jobs/public-job-page.ts: direct = directListing or sourceCategory 'employer'; offered to Google = direct,
-- confirmed open in the last 14 days (PUBLIC_JOB_VERIFIED_DAYS) and a description of 1,500+ bytes (PUBLIC_JOB_MIN_INDEX_DESCRIPTION).

-- 1. The buckets, whole board.
with s as (
  select ("directListing" is true or "sourceCategory" = 'employer') as direct,
         coalesce("lastVerifiedAt" >= now() - interval '14 days', false) as fresh14,
         coalesce("lastVerifiedAt" >= now() - interval '30 days', false) as fresh30,
         description is null as no_text,
         coalesce(octet_length(description) >= 1500, false) as long_text
  from "ExclusiveJobPosting" tablesample system (10) repeatable (7)
  where status = 'approved' and "archivedAt" is null and "closeReason" is null
)
select count(*) as live,
  count(*) filter (where not direct) as aggregator_or_other,
  count(*) filter (where direct) as direct,
  count(*) filter (where direct and fresh14 and long_text) as direct_offered_to_google,
  count(*) filter (where direct and long_text and not fresh14 and fresh30) as direct_stale_14_to_30d,
  count(*) filter (where direct and no_text) as direct_no_description,
  count(*) filter (where direct and not no_text and not long_text) as direct_description_under_1500,
  count(*) filter (where direct and not long_text and fresh14) as direct_text_missing_but_fresh
from s;

-- 2. By company: where the gap is. agg = aggregator copies (the "find their direct jobs" signal); stale = direct, good text, last
--    confirmed 14+ days ago (the crawler must re-verify); short = direct, confirmed this fortnight, but text missing or under 1,500 bytes.
with s as (
  select lower(btrim("companyName")) as co,
         ("directListing" is true or "sourceCategory" = 'employer') as direct,
         coalesce("lastVerifiedAt" >= now() - interval '14 days', false) as fresh14,
         coalesce(octet_length(description) >= 1500, false) as long_text
  from "ExclusiveJobPosting" tablesample system (10) repeatable (7)
  where status = 'approved' and "archivedAt" is null and "closeReason" is null
), g as (
  select co,
    count(*) filter (where not direct) as agg,
    count(*) filter (where direct and fresh14 and long_text) as offered,
    count(*) filter (where direct and long_text and not fresh14) as stale,
    count(*) filter (where direct and fresh14 and not long_text) as short
  from s group by co
)
select co, agg, offered, stale, short from g
where agg + stale + short >= 8
order by (agg + stale + short) desc
limit 70;
