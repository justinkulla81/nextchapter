-- Auto-join alumni groups by school (college) and department, as well as
-- major (src/lib/higher-ed/major-groups.ts). Additive only.

alter table public."InstitutionMember" add column if not exists "school" text;
alter table public."InstitutionMember" add column if not exists "department" text;
alter table public."AlumniGroup" add column if not exists "schools" text[] not null default '{}';
alter table public."AlumniGroup" add column if not exists "departments" text[] not null default '{}';
