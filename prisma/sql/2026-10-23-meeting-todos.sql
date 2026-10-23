-- To-dos from meeting notes: additive columns on CrmTask.
-- Apply once with:
--   npx prisma db execute --file prisma/sql/2026-10-23-meeting-todos.sql --schema prisma/schema.prisma

ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;
ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CrmTask_sourceRef_key" ON "CrmTask"("sourceRef");
