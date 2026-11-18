-- Founders: funding to date and exits, as the alum reports them (src/lib/higher-ed/ventures.ts). Additive.
alter table public."VentureFlag" add column if not exists "website" text;
alter table public."VentureFlag" add column if not exists "fundingRound" text;
alter table public."VentureFlag" add column if not exists "fundingTotal" text;
alter table public."VentureFlag" add column if not exists "exitKind" text;
alter table public."VentureFlag" add column if not exists "exitAcquirer" text;
alter table public."VentureFlag" add column if not exists "exitYear" integer;
alter table public."VentureFlag" add column if not exists "reportedAt" timestamp(3);
