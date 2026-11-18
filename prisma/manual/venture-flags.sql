-- Entrepreneurship center: founder flags, a staff role and a sharing switch (src/lib/higher-ed/ventures.ts). Additive.
alter type "InstitutionUserRole" add value if not exists 'ENTREPRENEURSHIP';
alter type "InstitutionConsentScope" add value if not exists 'SHARE_VENTURE';

create table if not exists public."VentureFlag" (
  "id" text primary key,
  "institutionId" text not null references public."Institution"("id") on delete cascade,
  "memberId" text not null references public."InstitutionMember"("id") on delete cascade,
  "status" text not null,
  "source" text not null,
  "ventureName" text,
  "ventureStage" text,
  "firstFlaggedAt" timestamp(3) not null default current_timestamp,
  "startedAt" timestamp(3),
  "contactedAt" timestamp(3),
  "contactedBy" text,
  "isSampleData" boolean not null default false,
  "updatedAt" timestamp(3) not null default current_timestamp
);
create unique index if not exists "VentureFlag_institutionId_memberId_key" on public."VentureFlag" ("institutionId", "memberId");
create index if not exists "VentureFlag_institutionId_status_idx" on public."VentureFlag" ("institutionId", "status");
alter table public."VentureFlag" enable row level security;
