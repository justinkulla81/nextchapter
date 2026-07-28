import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

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
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await prisma.exclusiveJobPosting.updateMany({
    where: { archivedAt: null, expiresAt: { lt: new Date() } },
    data: { archivedAt: new Date() },
  })

  return NextResponse.json({ expired: result.count })
}
