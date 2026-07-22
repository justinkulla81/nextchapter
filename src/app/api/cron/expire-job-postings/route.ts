import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

// Fires daily. Freshness enforcement for NC Job Board (Prompt 61) has to be
// real, not a UI label — anything whose expiresAt has passed gets archived
// here, so it's actually removed from candidate view, not just deprioritized.
// The only way expiresAt moves forward is a genuine reconfirmJobBoardPosting
// call (see src/lib/jobs/job-board-submission.ts) — there's no separate
// "bump" action anywhere that could reset this without it.
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
