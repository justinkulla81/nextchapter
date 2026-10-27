/**
 * Compute and store the whole-board figures now (what the cron /api/cron/board-figures does every six hours).
 * For the first fill, right after prisma/manual/2026-10-27-board-figure.sql, so no page runs the scan itself.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/refresh-board-figures.ts
 */
import { refreshBoardFigures } from '../src/lib/jobs/refresh-board-figures'
import { prisma } from '../src/lib/prisma'

refreshBoardFigures()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2))
    if (r.failed.length) process.exitCode = 1
  })
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
