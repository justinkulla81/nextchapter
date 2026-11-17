-- Auto-join alumni groups by major (src/lib/higher-ed/major-groups.ts).
-- Additive only: a new column on AlumniGroup and AlumniGroupMember, and a
-- new AlumniGroupLeave table so a member who leaves is never re-added.

alter table public."AlumniGroup" add column if not exists "majors" text[] not null default '{}';
alter table public."AlumniGroupMember" add column if not exists "joinedVia" text not null default 'MANUAL';

create table if not exists public."AlumniGroupLeave" (
  "id" text primary key,
  "groupId" text not null references public."AlumniGroup"("id") on delete cascade on update cascade,
  "memberId" text not null references public."InstitutionMember"("id") on delete cascade on update cascade,
  "leftAt" timestamp(3) not null default current_timestamp
);
create unique index if not exists "AlumniGroupLeave_groupId_memberId_key" on public."AlumniGroupLeave"("groupId", "memberId");
create index if not exists "AlumniGroupLeave_memberId_idx" on public."AlumniGroupLeave"("memberId");

-- Same as the other higher-ed tables: RLS on, the app's server role bypasses it.
alter table public."AlumniGroupLeave" enable row level security;
