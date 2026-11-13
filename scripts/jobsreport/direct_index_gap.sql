-- Direct-jobs-to-Google gap report. Run against production from a session or the Supabase SQL editor; keep the result, do not loop it.
--
-- Cost: a 10% block sample of ExclusiveJobPosting (about 57,000 of 573,000 live rows), three narrow columns plus description length.
-- Do not widen it to the whole table (CLAUDE.md, "Database egress"): a whole-board aggregate ran 14-18 s and touched ~35 GB of buffers.
-- Counts are the sample's, times 10 for the estimate. A company shows only when the sample holds 8+ of its gap rows (about 80 jobs).
-- Rules mirror src/lib/jobs/public-job-page.ts: direct = directListing or sourceCategory 'employer' (the live rule also counts employer ATS links and search firms, see isDirectJob); offered to Google = direct,
-- confirmed open in the last 14 days (PUBLIC_JOB_VERIFIED_DAYS) and a description of 1,500+ bytes (PUBLIC_JOB_MIN_INDEX_DESCRIPTION).

-- 1. Where direct jobs fall out, as mutually exclusive buckets in the order the sitemap rules meet them (public-job-page-server.ts).
with s as (
  select ("directListing" is true or "sourceCategory" = 'employer') as direct,
         coalesce(("locationCountry" = 'US' or ("locationCountry" is null and "locationState" is not null)), false) as us_ok,
         ("locationCountry" is null and "locationState" is null) as loc_unknown,
         coalesce(("employmentType" is null or "employmentType" not in ('internship','co_op','coop')) and title !~* '\m(intern|interns|internships?|student trainee)\M', false) as not_intern,
         (coalesce("reopenCount",0) < 2 and coalesce("repostCount",0) < 2) as reopen_ok,
         coalesce(length(description) >= 200, false) as text200,
         ("lastVerifiedAt" is null) as never_verified,
         coalesce("lastVerifiedAt" > now() - interval '14 days', false) as fresh14,
         coalesce("lastVerifiedAt" > now() - interval '30 days', false) as fresh30,
         coalesce(octet_length(description) >= 1500, false) as longtext, (description is null) as no_desc
  from "ExclusiveJobPosting" tablesample system (10) repeatable (7)
  where status = 'approved' and "archivedAt" is null and "closeReason" is null
), d as (select *, case
    when not us_ok and loc_unknown then '1a location unknown (no country, no state)'
    when not us_ok then '1b outside the US'
    when not not_intern then '1c internship'
    when not reopen_ok then '1d reopened or reposted twice or more'
    when not fresh14 and never_verified then '2a not confirmed: never verified'
    when not fresh14 and fresh30 then '2b not confirmed: last confirmed 14-30 days ago'
    when not fresh14 then '2c not confirmed: over 30 days'
    when no_desc then '3a no description stored'
    when not text200 or not longtext then '3b description under 1,500 bytes'
    else '4 offered' end as bucket from s where direct)
select bucket, count(*) as sample_n, count(*) * 10 as estimate from d group by 1 order by 1;

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
