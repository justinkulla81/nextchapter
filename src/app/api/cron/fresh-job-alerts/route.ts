import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { freshJobAlertsEnabled, sendFreshJobAlert } from '@/lib/jobs/fresh-job-alerts'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 300

const BREAK_ANSWER_WINDOW_DAYS = 30

// Instant new-job alerts — daily at 21:00 UTC (5pm ET), after the morning's
// crawl import, for strong fits posted in the last 24 hours. Sends nothing
// until FRESH_JOB_ALERTS_ENABLED=true; until then it reports who would get one.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const breakCutoff = new Date(Date.now() - BREAK_ANSWER_WINDOW_DAYS * 86_400_000)
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      deactivatedAt: null,
      freshJobAlertsOptedOut: false,
      jobSearchDailyOptedOut: false,
    },
    select: {
      id: true,
      searchCheckIns: {
        where: { respondedAt: { gte: breakCutoff } },
        orderBy: { respondedAt: 'desc' },
        take: 1,
        select: { answer: true },
      },
    },
  })

  const enabled = freshJobAlertsEnabled()
  let sent = 0
  let wouldSend = 0
  let failed = 0
  for (const candidate of eligible) {
    const lastAnswer = candidate.searchCheckIns[0]?.answer
    if (lastAnswer && lastAnswer !== 'STILL_SEARCHING') continue
    try {
      const result = await sendFreshJobAlert(candidate.id, { dryRun: !enabled })
      if (result.sent) sent++
      else if (result.reason === 'dry run') wouldSend++
    } catch (error) {
      failed++
      console.error('Fresh job alert failed for candidate', candidate.id, error)
    }
  }

  const summary = { enabled, checked: eligible.length, sent, wouldSend, failed }
  captureServerEvent('cron', 'fresh_job_alerts_run', summary)
  return NextResponse.json(summary)
}
