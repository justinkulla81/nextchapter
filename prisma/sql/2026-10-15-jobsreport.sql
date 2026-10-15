-- Jobs report data: raw postings for the monthly White Collar Jobs Report.
-- Additive only; does not touch ExclusiveJobPosting. RLS on with no policies,
-- so only the service role (pipeline) can read or write.

create table if not exists jobsreport_run (
  run_id        bigserial primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  geo           text,
  source_name   text not null,
  source_type   text not null,          -- direct_ats | aggregator | search_firm | marketplace | public_sector
  fetched       integer not null default 0,
  failed        integer not null default 0,
  note          text
);

create table if not exists jobsreport_posting (
  posting_id     text primary key,      -- source_name || ':' || external id
  source_name    text not null,
  source_type    text not null,
  employer       text not null,
  employer_domain text,
  title          text not null,
  req_id         text,
  url            text,
  description    text,                   -- full text, sections preserved
  desc_hash      text,
  location_raw   text,
  city           text,
  state          text,
  county_fips    text,                   -- 5-digit; 21111 = Jefferson County, KY
  locations      text[],                 -- all locations for multi-location postings
  level          text,                   -- all levels, incl. entry-level and hourly
  arrangement    text,                   -- remote | hybrid | onsite | unspecified (from source flag)
  employment_type text,
  pay_min        numeric,
  pay_max        numeric,
  pay_period     text,
  pay_stated     boolean,                -- false when the board estimated pay
  posted_at      timestamptz,            -- source date
  posted_precision text,                 -- timestamp | date | relative
  source_updated_at timestamptz,
  first_seen     timestamptz not null default now(),
  last_seen      timestamptz not null default now(),
  closed_at      timestamptz,
  missed_runs    integer not null default 0,
  last_run_id    bigint references jobsreport_run(run_id)
);

create index if not exists jobsreport_posting_county_idx on jobsreport_posting (county_fips);
create index if not exists jobsreport_posting_employer_idx on jobsreport_posting (employer);
create index if not exists jobsreport_posting_last_seen_idx on jobsreport_posting (last_seen);

-- Text version history: one row each time the description changes.
create table if not exists jobsreport_posting_version (
  posting_id  text not null references jobsreport_posting(posting_id) on delete cascade,
  seen_at     timestamptz not null default now(),
  desc_hash   text not null,
  title       text,
  description text,
  pay_min     numeric,
  pay_max     numeric,
  primary key (posting_id, desc_hash)
);

alter table jobsreport_run enable row level security;
alter table jobsreport_posting enable row level security;
alter table jobsreport_posting_version enable row level security;
