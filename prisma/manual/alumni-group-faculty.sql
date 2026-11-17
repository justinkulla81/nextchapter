-- Faculty in alumni industry and function groups. Additive only.
create table if not exists public."AlumniGroupFaculty" (
  "id" text primary key,
  "groupId" text not null references public."AlumniGroup"("id") on delete cascade on update cascade,
  "institutionUserId" text not null references public."InstitutionUser"("id") on delete cascade on update cascade,
  "createdAt" timestamp(3) not null default current_timestamp
);
create unique index if not exists "AlumniGroupFaculty_groupId_institutionUserId_key" on public."AlumniGroupFaculty"("groupId", "institutionUserId");
create index if not exists "AlumniGroupFaculty_institutionUserId_idx" on public."AlumniGroupFaculty"("institutionUserId");
alter table public."AlumniGroupFaculty" enable row level security;
