import { notLookingNow } from '@/lib/journey/journey'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { freshJobAlertsEnabled, sendFreshJobAlert } from '@/lib/jobs/fresh-job-alerts'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

const BREAK_ANSWER_WINDOW_DAYS = 30
// Members processed at once, and the point after which no new member is started
// (leaves headroom under maxDuration for in-flight sends and the summary).
const CONCURRENCY = 6
const DEADLINE_MS = 240_000

// Instant new-job alerts — every 3 hours during US daytime (13:30–01:30 UTC),
// after the crawler's hot-tier imports, for strong fits posted in the last 24
// hours; still at most one alert per member per 24 hours. Sends nothing
// until FRESH_JOB_ALERTS_ENABLED=true; until then it reports who would get one.
export const GET = withCronRun('fresh-job-alerts', async () => {
  const startedAt = Date.now()

  const breakCutoff = new Date(Date.now() - BREAK_ANSWER_WINDOW_DAYS * 86_400_000)
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      deactivatedAt: null,
      freshJobAlertsOptedOut: false,
      jobSearchDailyOptedOut: false,
      notificationTier: { not: 'MINIMAL' },
    },
    select: {
      id: true,
      journey: true,
      journeyStage: true,
      currentJobStatus: true,
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
  let capped = 0
  let skippedForTime = 0

  // Rotate the start (by the 3-hour slot) so the same members aren't always
  // last when a run is cut short by the deadline.
  const offset = eligible.length > 0 ? (Math.floor(startedAt / 10_800_000) * 97) % eligible.length : 0
  const queue = [...eligible.slice(offset), ...eligible.slice(0, offset)]

  const processCandidate = async (candidate: (typeof eligible)[number]) => {
    if (notLookingNow(candidate)) return
    const lastAnswer = candidate.searchCheckIns[0]?.answer
    if (lastAnswer && lastAnswer !== 'STILL_SEARCHING') return
    try {
      const result = await sendFreshJobAlert(candidate.id, { dryRun: !enabled })
      if (result.sent) sent++
      else if (result.reason === 'dry run') wouldSend++
      else if (result.reason === 'already alerted today') capped++
    } catch (error) {
      failed++
      console.error('Fresh job alert failed for candidate', candidate.id, error)
    }
  }

  // Bounded concurrency: workers pull the next member until none are left or
  // the deadline passes. Members not reached are counted, never silently lost.
  let next = 0
  const worker = async () => {
    while (next < queue.length) {
      const candidate = queue[next++]
      if (Date.now() - startedAt > DEADLINE_MS) {
        skippedForTime++
        continue
      }
      await processCandidate(candidate)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  if (skippedForTime > 0) console.error(`Fresh job alerts: ${skippedForTime} member(s) not reached before the ${DEADLINE_MS}ms deadline`)

  const summary = { enabled, checked: eligible.length, sent, wouldSend, capped, failed, skippedForTime }
  captureServerEvent('cron', 'fresh_job_alerts_run', summary)
  return NextResponse.json(summary)
})
