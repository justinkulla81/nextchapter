import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runMorningMotivation } from '@/lib/email/dispatch/run-morning-motivation'
import { runMarketUpdate } from '@/lib/email/dispatch/run-market-update'
import { runDailyNudge } from '@/lib/email/dispatch/run-daily-nudge'
import { runMidweekCheckin } from '@/lib/email/dispatch/run-midweek-checkin'
import { runGapNudge } from '@/lib/email/dispatch/run-gap-nudge'
import { runCommunityDigest } from '@/lib/email/dispatch/run-community-digest'
import { runFinishLine } from '@/lib/email/dispatch/run-finish-line'

// Fires hourly (see vercel.json). Looks up the one CandidateEmailSchedule
// row matching the current UTC day-of-week + hour and dispatches to that
// email's sender — the admin-editable replacement for the 5 separate
// per-email crons this used to be (see the CandidateEmailSchedule /
// CandidateEmailSendLog models in schema.prisma). If no row matches this
// exact hour, this is a no-op tick.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const row = await prisma.candidateEmailSchedule.findFirst({
    where: { dayOfWeek: now.getUTCDay(), sendHourUtc: now.getUTCHours(), isActive: true },
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
    case 'COMMUNITY_DIGEST': {
      const result = await runCommunityDigest(introCopy, eligiblePrivacyTiers)
      return NextResponse.json({ dispatched: row.emailKey, ...result })
    }
    case 'FINISH_LINE': {
      const result = await runFinishLine(introCopy, eligiblePrivacyTiers)
      return NextResponse.json({ dispatched: row.emailKey, ...result })
    }
  }
}
