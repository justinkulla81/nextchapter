-- The skills bridge (src/lib/higher-ed/skills-bridge.ts). Additive only.
create table if not exists public."SkillBridgeEvent" (
  "id" text primary key,
  "institutionId" text not null,
  "memberId" text not null,
  "kind" text not null,
  "skill" text not null,
  "offeringKey" text not null default '',
  "createdAt" timestamp(3) not null default current_timestamp
);
create unique index if not exists "SkillBridgeEvent_memberId_kind_skill_offeringKey_key" on public."SkillBridgeEvent"("memberId", "kind", "skill", "offeringKey");
create index if not exists "SkillBridgeEvent_institutionId_kind_idx" on public."SkillBridgeEvent"("institutionId", "kind");
alter table public."SkillBridgeEvent" enable row level security;
