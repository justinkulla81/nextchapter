-- A member invites their partner (spouse, partner, significant other) to search together, mainly for a move.
-- Additive. The partner joins with their own account (matched by the email the invite went to) and keeps their own search.
-- MovePlace is the set of metro areas the pair is comparing.
create table if not exists "PartnerLink" (
  "id"           text primary key,
  "ownerId"      text not null references "CandidateProfile"("id") on delete cascade,
  "partnerName"  text not null,
  "partnerEmail" text not null,
  "partnerId"    text references "CandidateProfile"("id") on delete set null,
  "sharePlaces"  boolean not null default true,
  "shareJobsPay" boolean not null default true,
  "createdAt"    timestamp(3) not null default current_timestamp,
  "joinedAt"     timestamp(3),
  "revokedAt"    timestamp(3)
);
create unique index if not exists "PartnerLink_ownerId_partnerEmail_key" on "PartnerLink"("ownerId", "partnerEmail");
create index if not exists "PartnerLink_partnerId_idx" on "PartnerLink"("partnerId");
create index if not exists "PartnerLink_partnerEmail_idx" on "PartnerLink"("partnerEmail");

create table if not exists "MovePlace" (
  "id"        text primary key,
  "ownerId"   text not null references "CandidateProfile"("id") on delete cascade,
  "addedById" text not null,
  "metroCode" text not null,
  "name"      text not null,
  "createdAt" timestamp(3) not null default current_timestamp
);
create unique index if not exists "MovePlace_ownerId_metroCode_key" on "MovePlace"("ownerId", "metroCode");
