import { notLookingNow } from '@/lib/journey/journey'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { hasAlreadySentToday } from '@/lib/email/send-log'
import { sendJobSearchDaily } from '@/lib/email/send-job-search-daily'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

const BREAK_ANSWER_WINDOW_DAYS = 30
// Building one candidate's email is several queries plus a send, so a serial
// pass over every candidate outgrows the limit. A few workers share the list.
const CONCURRENCY = 4
// Stop starting new candidates here so the run finishes cleanly (and records
// its result) instead of being killed at the limit.
const DEADLINE_MS = 240_000

// Job Search Daily — every day at 12:00 UTC (8am ET), an hour ahead of the
// weekday-rotation email from candidate-email-dispatch, which it's sent on
// top of (founder decision, 2026-10-07). Own opt-out flag, own send-log key.
export const GET = withCronRun('job-search-daily', async () => {

  const breakCutoff = new Date(Date.now() - BREAK_ANSWER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      deactivatedAt: null,
      jobSearchDailyOptedOut: false,
    },
    select: {
      id: true,
      notificationTier: true,
      journey: true,
      journeyStage: true,
      currentJobStatus: true,
      // Saturday's "still searching?" answer — someone who said they're
      // managing their career or got an offer shouldn't get a daily search email.
      searchCheckIns: {
        where: { respondedAt: { gte: breakCutoff } },
        orderBy: { respondedAt: 'desc' },
        take: 1,
        select: { answer: true },
      },
    },
  })

  const queue = eligible.filter((candidate) => {
    if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) return false
    if (notLookingNow(candidate)) return false
    const lastAnswer = candidate.searchCheckIns[0]?.answer
    return !lastAnswer || lastAnswer === 'STILL_SEARCHING'
  })

  const startedAt = Date.now()
  let sent = 0
  let skippedNothingNew = 0
  let failed = 0
  let skippedForTime = 0
  let next = 0

  // Workers pull the next candidate until none are left or the deadline
  // passes. Candidates not reached are counted, never silently lost.
  const worker = async () => {
    while (next < queue.length) {
      const candidate = queue[next++]
      if (Date.now() - startedAt > DEADLINE_MS) {
        skippedForTime++
        continue
      }
      try {
        if (await hasAlreadySentToday(candidate.id, 'JOB_SEARCH_DAILY')) continue
        const result = await sendJobSearchDaily(candidate.id)
        if (result.sent) sent++
        else if (result.reason === 'nothing new') skippedNothingNew++
      } catch (error) {
        failed++
        console.error('Job Search Daily failed for candidate', candidate.id, error)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  if (skippedForTime > 0) console.error(`Job Search Daily: ${skippedForTime} candidate(s) not reached before the ${DEADLINE_MS}ms deadline`)

  captureServerEvent('cron', 'job_search_daily_run', {
    checked: eligible.length,
    sent,
    skippedNothingNew,
    failed,
    skippedForTime,
  })
  // Candidates left unsent make the run FAILED so the job watchdog emails about
  // it. Re-running by hand is safe: anyone already sent today is skipped.
  return NextResponse.json(
    { checked: eligible.length, sent, skippedNothingNew, failed, skippedForTime },
    { status: skippedForTime > 0 ? 500 : 200 }
  )
})
