-- Claims on an organization's public page (/prepared/<slug>). Additive; nothing existing is changed.
-- A claim is verified only when the one-time link emailed to the claimant's work address is used.
-- tokenHash is a SHA-256 of the token (the token itself is never stored); ipHash is a salted hash of the IP, used only to limit requests.
create table if not exists "OrgClaim" (
  "id"                text primary key,
  "crmOrganizationId" text not null references "CrmOrganization"("id") on delete cascade,
  "name"              text not null,
  "title"             text not null,
  "email"             text not null,
  "emailDomain"       text not null,
  "tokenHash"         text not null,
  "expiresAt"         timestamp(3) not null,
  "verifiedAt"        timestamp(3),
  "needsReview"       boolean not null default false,
  "ipHash"            text,
  "createdAt"         timestamp(3) not null default current_timestamp
);
create unique index if not exists "OrgClaim_tokenHash_key" on "OrgClaim"("tokenHash");
create index if not exists "OrgClaim_crmOrganizationId_idx" on "OrgClaim"("crmOrganizationId");
create index if not exists "OrgClaim_email_createdAt_idx" on "OrgClaim"("email", "createdAt");
create index if not exists "OrgClaim_ipHash_createdAt_idx" on "OrgClaim"("ipHash", "createdAt");
