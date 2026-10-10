-- Skills extracted from each posting's description at import (a fixed-vocabulary scan,
-- no AI). Lets the skills gap and fit scoring work while only a short excerpt of the
-- description is stored. Additive and re-runnable: one nullable-safe array column.
--
-- RUN BEFORE the deploy that reads it (Prisma selects every scalar column).
ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
