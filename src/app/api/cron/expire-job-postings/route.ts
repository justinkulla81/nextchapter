import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCronRun } from '@/lib/cron/run'

// Fires daily, 30 minutes before the ats-job-board-feed cron — freshness
// enforcement runs on the same cadence as the fetch that repopulates the
// queue, so a company's removed listing never lingers longer than one
// fetch cycle after it stops being reconfirmed. Anything whose expiresAt
// has passed gets archived (soft-hidden, not deleted) so it's actually
// removed from candidate view without losing admin history. A pending
// posting that was never approved after 30 days, or one that's gone quiet
// because the company took it down, ages out the same way. The only way
// expiresAt moves forward is a genuine reconfirmJobBoardPosting call (see
// src/lib/jobs/job-board-submission.ts) or the ATS feed re-finding the same
// URL still live — never a bare "bump."
export const maxDuration = 300

const TRIM_BATCH = 2_000
const TRIM_MAX_BATCHES = 25

export const GET = withCronRun('expire-job-postings', async () => {
  const result = await prisma.exclusiveJobPosting.updateMany({
    where: { archivedAt: null, expiresAt: { lt: new Date() } },
    // closeReason 'expired': not reconfirmed in time (src/lib/jobs/job-status.ts).
    data: { archivedAt: new Date(), closeReason: 'expired' },
  })

  // Full descriptions are stored for open jobs (aggregator feeds need them). A posting closed
  // over 30 days ago goes back to the ~1,000-character excerpt, so closed rows don't grow the
  // database without bound; if it is listed again the next import stores the full text.
  // Bounded batches with a short statement timeout, so the cron never holds long locks.
  let trimmed = 0
  for (let i = 0; i < TRIM_MAX_BATCHES; i++) {
    const n = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '20s'`)
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '5s'`)
      return tx.$executeRaw`
        UPDATE public."ExclusiveJobPosting" SET "description" = left("description", 1000) || '…'
        WHERE id IN (
          SELECT id FROM public."ExclusiveJobPosting"
          WHERE "archivedAt" < now() - interval '30 days' AND octet_length("description") > 4000
          LIMIT ${TRIM_BATCH}
        )`
    }, { timeout: 30_000 })
    trimmed += n
    if (n < TRIM_BATCH) break
  }

  return NextResponse.json({ expired: result.count, trimmedClosedDescriptions: trimmed })
})
