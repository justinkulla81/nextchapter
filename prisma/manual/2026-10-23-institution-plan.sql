-- Institution plan (src/lib/plans/entitlements.ts). Additive only. Apply by hand; never `prisma db push` on prod.
-- 'PAID' is the default so every existing institution keeps everything it has today (grandfathered).
-- New free workspaces are created with plan = 'FREE' by src/lib/plans/provision.ts.
alter table "Institution" add column if not exists "plan" text not null default 'PAID';
