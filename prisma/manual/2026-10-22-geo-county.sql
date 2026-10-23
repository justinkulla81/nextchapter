-- Place every job posting in a county, nationwide, and keep it placed.
-- Applied to production on 2026-10-22 through the Supabase connector. Additive only; safe to re-run.
--
-- Data: U.S. Census Bureau place-by-county codes (2020) and county adjacency file, both public.
--   https://www2.census.gov/geo/docs/reference/codes2020/national_place_by_county2020.txt
--   https://www2.census.gov/geo/docs/reference/county_adjacency.txt
-- The `http` extension loads them inside the database (requests must send a User-Agent or census.gov returns 403).

create extension if not exists http with schema extensions;

create table if not exists "GeoCounty" (fips text primary key, name text not null, state text not null);
create table if not exists "GeoPlaceCounty" (
  state text not null, place_key text not null, county_fips text not null, place_name text not null,
  multi boolean not null default false,       -- the place spans more than one county
  preferred boolean not null default true,    -- the county used for the single-county column
  primary key (state, place_key, county_fips));
create table if not exists "GeoCountyAdjacent" (county_fips text not null, adjacent_fips text not null, primary key (county_fips, adjacent_fips));
create table if not exists "GeoLocationCounty" (location text primary key, state text, place_key text, county_fips text, ambiguous boolean not null default false);
alter table "GeoCounty" enable row level security; alter table "GeoPlaceCounty" enable row level security;
alter table "GeoCountyAdjacent" enable row level security; alter table "GeoLocationCounty" enable row level security;

alter table "CompanyJobOpening" add column if not exists "countyFips" text;        -- preferred county for the posting's location
alter table "CompanyJobOpening" add column if not exists "countyAmbiguous" boolean; -- true when the place spans several counties
create index if not exists "CompanyJobOpening_countyFips_open_idx" on "CompanyJobOpening" ("countyFips") where "closedAt" is null;

-- Name key shared by Census place names and posting city names ("St. Louis city" and "Saint Louis" both become "st louis").
create or replace function public.geo_place_key(raw text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(btrim(regexp_replace(lower(coalesce(raw,'')), '\(balance\)', '', 'g')),
    '(\s+(city and borough|city|town|village|borough|cdp|municipality|township|plantation|comunidad|zona urbana|urban county|metro government|metropolitan government|consolidated government|unified government|county))+$', '', 'g'),
    '^urban\s+', '', 'g'), '[.'']', '', 'g'), '\m(saint|ste)\M', 'st', 'g'))
$$;

-- "City, ST", "City, State, United States", "City, ST, US, 40202" -> (city, state abbreviation). Anything else returns no row.
create or replace function public.geo_parse_location(loc text) returns table(city text, st text) language sql immutable as $$
  with s(name, ab) as (values ('alabama','AL'),('alaska','AK'),('arizona','AZ'),('arkansas','AR'),('california','CA'),('colorado','CO'),('connecticut','CT'),('delaware','DE'),('district of columbia','DC'),('florida','FL'),('georgia','GA'),('hawaii','HI'),('idaho','ID'),('illinois','IL'),('indiana','IN'),('iowa','IA'),('kansas','KS'),('kentucky','KY'),('louisiana','LA'),('maine','ME'),('maryland','MD'),('massachusetts','MA'),('michigan','MI'),('minnesota','MN'),('mississippi','MS'),('missouri','MO'),('montana','MT'),('nebraska','NE'),('nevada','NV'),('new hampshire','NH'),('new jersey','NJ'),('new mexico','NM'),('new york','NY'),('north carolina','NC'),('north dakota','ND'),('ohio','OH'),('oklahoma','OK'),('oregon','OR'),('pennsylvania','PA'),('rhode island','RI'),('south carolina','SC'),('south dakota','SD'),('tennessee','TN'),('texas','TX'),('utah','UT'),('vermont','VT'),('virginia','VA'),('washington','WA'),('west virginia','WV'),('wisconsin','WI'),('wyoming','WY')),
  c as (select btrim(regexp_replace(coalesce(loc,''), ',\s*(united states( of america)?|usa|us)\s*$', '', 'i')) t),
  m1 as (select (regexp_match(t, '^([^,;|/]+),\s*([A-Za-z]{2})\s*(\d{5}(-\d{4})?)?$'))[1] city, upper((regexp_match(t, '^([^,;|/]+),\s*([A-Za-z]{2})\s*(\d{5}(-\d{4})?)?$'))[2]) st from c),
  m2 as (select (regexp_match(t, '^([^,;|/]+),\s*([A-Za-z ]+)$'))[1] city, (regexp_match(t, '^([^,;|/]+),\s*([A-Za-z ]+)$'))[2] sname from c)
  select coalesce(m1.city, m2.city), coalesce(case when m1.st in (select ab from s) then m1.st end, (select ab from s where name = lower(btrim(m2.sname))))
  from m1, m2
$$;

-- County for a posting location. Several rows' worth of candidates collapse to the preferred county plus an ambiguity flag.
create or replace function public.geo_county_for_location(loc text) returns table(county_fips text, ambiguous boolean) language sql stable as $$
  select (array_agg(g.county_fips order by g.preferred desc, g.county_fips))[1], count(*) > 1
  from public.geo_parse_location(loc) p
  join "GeoPlaceCounty" g on g.state = p.st and g.place_key = public.geo_place_key(p.city)
$$;

create or replace function public.company_job_opening_set_county() returns trigger language plpgsql as $$
begin
  if new.location is not null and (tg_op = 'INSERT' or new.location is distinct from old.location) then
    begin
      select c.county_fips, c.ambiguous into new."countyFips", new."countyAmbiguous" from public.geo_county_for_location(new.location) c;
    exception when others then
      new."countyFips" := null; new."countyAmbiguous" := null;  -- never block an import
    end;
  end if;
  return new;
end $$;

create trigger company_job_opening_set_county before insert or update of location on "CompanyJobOpening"
  for each row execute function public.company_job_opening_set_county();

-- Backfill (run in id ranges, 'cjo0%' .. 'cjof%', because one statement over the whole table times out):
--   update "CompanyJobOpening" o set "countyFips" = l.county_fips, "countyAmbiguous" = l.ambiguous
--   from "GeoLocationCounty" l where o.location = l.location and l.county_fips is not null and o.id like 'cjo0%';
-- "GeoLocationCounty" is a cache of every distinct location string, filled from geo_parse_location and "GeoPlaceCounty".
-- Big places that span counties are pinned to their main county (New York to New York County, Houston to Harris, Atlanta to
-- Fulton, ...); other multi-county places use the lowest county code and carry countyAmbiguous = true. Reports count a posting in an
-- area if ANY candidate county of its place is in the area.
