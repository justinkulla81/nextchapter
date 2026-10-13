import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runMorningMotivation } from '@/lib/email/dispatch/run-morning-motivation'
import { runMarketUpdate } from '@/lib/email/dispatch/run-market-update'
import { runDailyNudge } from '@/lib/email/dispatch/run-daily-nudge'
import { runMidweekCheckin } from '@/lib/email/dispatch/run-midweek-checkin'
import { runGapNudge } from '@/lib/email/dispatch/run-gap-nudge'
import { runSearchCheckin } from '@/lib/email/dispatch/run-search-checkin'
import { runFinishLine } from '@/lib/email/dispatch/run-finish-line'
import { withCronRun } from '@/lib/cron/run'

// Fires once daily at 13:00 UTC (see vercel.json) — Vercel Hobby plan caps
// cron jobs at once/day, so an hourly dispatcher (this route's original
// design) fails deployment outright ("Hobby accounts are limited to daily
// cron jobs"). Looks up today's active CandidateEmailSchedule row by
// dayOfWeek alone and dispatches to that email's sender — the admin-editable
// replacement for the 5 separate per-email crons this used to be (see the
// CandidateEmailSchedule / CandidateEmailSendLog models in schema.prisma).
// Each row's sendHourUtc is no longer load-bearing for timing on this plan
// (every email now goes out around this one fixed daily run, imprecise to
// within Hobby's ±59min window) — it stays in the schema/admin UI as
// forward-compatible metadata for the day this project upgrades to Pro,
// where per-row hour matching can be restored.
export const GET = withCronRun('candidate-email-dispatch', async () => {
  const now = new Date()
  const row = await prisma.candidateEmailSchedule.findFirst({
    where: { dayOfWeek: now.getUTCDay(), isActive: true },
  })

  if (!row) {
    return NextResponse.json({ dispatched: null })
  }

  const introCopy = row.introCopy ?? null
  const eligiblePrivacyTiers = row.eligiblePrivacyTiers

  switch (row.emailKey) {
    case 'MORNING_MOTIVATION': {
      const result = await runMorningMotivation(introCopy, eligiblePrivacyTiers)
      return NextResponse.json({ dispatched: row.emailKey, ...result })
    }
    case 'MARKET_UPDATE': {
      const result = await runMarketUpdate(introCopy, eligiblePrivacyTiers)
      return NextResponse.json({ dispatched: row.emailKey, ...result })
    }
    case 'DAILY_NUDGE': {
      const result = await runDailyNudge(introCopy, eligiblePrivacyTiers)
      return NextResponse.json({ dispatched: row.emailKey, ...result })
    }
    case 'MIDWEEK_CHECKIN': {
      const result = await runMidweekCheckin(introCopy, eligiblePrivacyTiers)
      return NextResponse.json({ dispatched: row.emailKey, ...result })
    }
    case 'GAP_NUDGE': {
      const result = await runGapNudge(introCopy, eligiblePrivacyTiers)
      return NextResponse.json({ dispatched: row.emailKey, ...result })
    }
    case 'SEARCH_CHECKIN': {
      const result = await runSearchCheckin(introCopy, eligiblePrivacyTiers)
      return NextResponse.json({ dispatched: row.emailKey, ...result })
    }
    case 'FINISH_LINE': {
      const result = await runFinishLine(introCopy, eligiblePrivacyTiers)
      return NextResponse.json({ dispatched: row.emailKey, ...result })
    }
    default:
      // An unknown key used to fall out of the switch with no response at all.
      return NextResponse.json({ error: `Unknown email key ${row.emailKey}` }, { status: 422 })
  }
})
