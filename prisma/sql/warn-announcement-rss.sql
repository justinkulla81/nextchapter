-- Opt-in RSS publishing for layoff announcements. Additive. Apply once with:
--   npx prisma db execute --file prisma/sql/warn-announcement-rss.sql --schema prisma/schema.prisma

ALTER TABLE "WarnNotice" ADD COLUMN "rssPublishedAt" TIMESTAMP(3);
