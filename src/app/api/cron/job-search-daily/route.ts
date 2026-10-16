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

  let sent = 0
  let skippedNothingNew = 0
  let failed = 0
  for (const candidate of eligible) {
    if (!shouldSendWeeklyExtraForTier(candidate.notificationTier)) continue
    if (notLookingNow(candidate)) continue
    const lastAnswer = candidate.searchCheckIns[0]?.answer
    if (lastAnswer && lastAnswer !== 'STILL_SEARCHING') continue
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

  captureServerEvent('cron', 'job_search_daily_run', {
    checked: eligible.length,
    sent,
    skippedNothingNew,
    failed,
  })
  return NextResponse.json({
    checked: eligible.length,
    sent,
    skippedNothingNew,
    failed,
  })
})
