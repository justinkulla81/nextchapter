-- AI exposure of the live job-board feed for one place. White-collar = SOC major groups 11-29 (Census groups 1 and 2).
-- aei_soc_code comes from the feed's own Anthropic Economic Index matching; exposure level is the feed's low/medium/high.
create or replace function jobsfeed_exposure(p_states text[], p_cities text[])
returns jsonb language sql stable security definer set search_path = public as $fn$
with titles as (
  select "aeiSocCode" code, mode() within group (order by "socTitle") title from "ExclusiveJobPosting" where "socTitle" is not null and "aeiSocCode" is not null group by 1),
f as (
  select e.*, left(e."aeiSocCode", 2) maj, t.title occ_title,
         case when e."level" in ('ENTRY_IC','EARLY_IC') then 'entry and early' when e."level" in ('MID_IC','SENIOR_IC','PRINCIPAL') then 'individual contributor' else 'management and above' end lvl
  from "ExclusiveJobPosting" e left join titles t on t.code = e."aeiSocCode"
  where e."archivedAt" is null and e."locationState" = any(p_states) and lower(e."locationCity") = any(p_cities)),
w as (select * from f where maj between '11' and '29')
select jsonb_build_object(
 'live', (select count(*) from f),
 'white_collar', (select count(*) from w),
 'by_source', (select coalesce(jsonb_agg(jsonb_build_object('category', c, 'n', n) order by n desc), '[]') from (select "sourceCategory" c, count(*) n from f group by 1) x),
 'by_level', (select coalesce(jsonb_agg(jsonb_build_object('level', lvl, 'n', n) order by n desc), '[]') from (select lvl, count(*) n from w group by 1) x),
 'exposure', (select coalesce(jsonb_agg(jsonb_build_object('level', lv, 'n', n) order by n desc), '[]') from (select coalesce("aiExposureLevel",'unknown') lv, count(*) n from w group by 1) x),
 'exposure_entry', (select coalesce(jsonb_agg(jsonb_build_object('level', lv, 'n', n) order by n desc), '[]') from (select coalesce("aiExposureLevel",'unknown') lv, count(*) n from w where lvl = 'entry and early' group by 1) x),
 'soc_from_title_pct', (select round(100.0 * count(*) filter (where "aeiSocSource" = 'title') / nullif(count(*),0), 1) from w),
 'top_occupations', (select coalesce(jsonb_agg(jsonb_build_object('soc', code, 'title', title, 'n', n, 'exposure', lv) order by n desc), '[]') from (
     select "aeiSocCode" code, coalesce(max(occ_title), "aeiSocCode") title, count(*) n, mode() within group (order by "aiExposureLevel") lv
     from w where "aeiSocCode" is not null group by 1 order by 3 desc limit 12) x),
 'top_high_exposure', (select coalesce(jsonb_agg(jsonb_build_object('soc', code, 'title', title, 'n', n) order by n desc), '[]') from (
     select "aeiSocCode" code, coalesce(max(occ_title), "aeiSocCode") title, count(*) n from w where "aiExposureLevel" = 'high' and "aeiSocCode" is not null group by 1 order by 3 desc limit 10) x)
);
$fn$;
revoke all on function jobsfeed_exposure(text[], text[]) from public, anon, authenticated;
