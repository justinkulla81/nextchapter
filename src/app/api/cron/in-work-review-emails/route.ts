import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendInWorkReviewEmail } from '@/lib/email/send-in-work-review-email'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { IN_WORK_JOURNEYS } from '@/lib/in-work/constants'
import { decideOutreach, describeWindow, startOfUtcDay, type OutreachDecision, type SentRecord } from '@/lib/in-work/review-schedule'
import { buildReviewEmailContent } from '@/lib/in-work/outreach'
import { scheduleInputFrom } from '@/lib/in-work/settings'

export const maxDuration = 300

// Twice-yearly review emails: PREPARE about three weeks before a member's
// review window, RESPOND five to seven days after it.
//
// SHIPS DISABLED. Nothing is sent unless IN_WORK_REVIEW_EMAILS_ENABLED=true.
// Add ?dryRun=1 to list who WOULD be emailed (no sends, no claims, works with
// the flag off). Volume guards: IN_WORK_REVIEW_EMAILS_MAX_PER_RUN (default 25)
// and IN_WORK_REVIEW_EMAILS_DAILY_CAP (default 25, counted from InWorkEmailSend
// for today), so a first run cannot spend the day's whole Resend quota.
function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const flagOn = process.env.IN_WORK_REVIEW_EMAILS_ENABLED === 'true'
  const dryRunParam = request.nextUrl.searchParams.get('dryRun')
  const dryRun = dryRunParam === '1' || dryRunParam === 'true'
  if (!flagOn && !dryRun) {
    return NextResponse.json({ enabled: false, message: 'IN_WORK_REVIEW_EMAILS_ENABLED is not true. Nothing sent. Use ?dryRun=1 to preview.' })
  }

  const now = new Date()
  const eligible = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      deactivatedAt: null,
      notificationTier: { not: 'MINIMAL' },
      // Employed journeys only. Members from before journeys fall back to
      // their old job status, same as effectiveJourney().
      OR: [
        { journey: { in: [...IN_WORK_JOURNEYS] } },
        { journey: null, currentJobStatus: { in: ['EMPLOYED_CONSIDERING_MOVE', 'SEEKING_PROMOTION'] } },
      ],
      // Paused means no nudges.
      AND: [
        { OR: [{ journeyStage: null }, { journeyStage: { not: 'PAUSED' } }] },
        { OR: [{ inWorkProfile: { is: null } }, { inWorkProfile: { promptsEnabled: true } }] },
      ],
    },
    select: {
      id: true,
      notificationTier: true,
      inWorkProfile: { select: { cadence: true, anchorMonth: true, nextReviewDate: true } },
      inWorkEmailSends: { select: { cycleKey: true, kind: true, sentAt: true } },
      inWorkOutcomes: { select: { cycleKey: true } },
    },
    take: 10_000,
  })

  const decisions: { candidateId: string; decision: OutreachDecision }[] = []
  for (const c of eligible) {
    if (!shouldSendWeeklyExtraForTier(c.notificationTier)) continue
    const sent: SentRecord[] = c.inWorkEmailSends
      .filter((s) => s.kind === 'PREPARE' || s.kind === 'RESPOND')
      .map((s) => ({ cycleKey: s.cycleKey, kind: s.kind as 'PREPARE' | 'RESPOND', sentAt: s.sentAt }))
    const outcomeKeys = new Set(c.inWorkOutcomes.map((o) => o.cycleKey).filter((k): k is string => !!k))
    const decision = decideOutreach(scheduleInputFrom(c.inWorkProfile), now, sent, outcomeKeys)
    if (decision) decisions.push({ candidateId: c.id, decision })
  }

  const byKind = {
    PREPARE: decisions.filter((d) => d.decision.kind === 'PREPARE').length,
    RESPOND: decisions.filter((d) => d.decision.kind === 'RESPOND').length,
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      flagEnabled: flagOn,
      checked: eligible.length,
      wouldSend: decisions.length,
      byKind,
      // Ids only, no addresses or names.
      items: decisions.slice(0, 200).map(({ candidateId, decision }) => ({
        candidateId,
        kind: decision.kind,
        cycleKey: decision.cycle.key,
        window: describeWindow(decision.cycle),
        subject: buildReviewEmailContent({ kind: decision.kind, cycle: decision.cycle, firstName: null, winCount: 0, openFollowUps: 0 }).subject,
      })),
      truncated: decisions.length > 200,
    })
  }

  const maxPerRun = intEnv('IN_WORK_REVIEW_EMAILS_MAX_PER_RUN', 25)
  const dailyCap = intEnv('IN_WORK_REVIEW_EMAILS_DAILY_CAP', 25)
  const sentToday = await prisma.inWorkEmailSend.count({ where: { sentAt: { gte: startOfUtcDay(now) } } })
  const budget = Math.max(0, Math.min(maxPerRun, dailyCap - sentToday))

  let sent = 0
  let failed = 0
  let skipped = 0
  for (const { candidateId, decision } of decisions) {
    if (sent >= budget) break
    try {
      const result = await sendInWorkReviewEmail(candidateId, decision)
      if (result.sent) sent++
      else skipped++
    } catch (error) {
      failed++
      console.error('In-work review email failed for candidate', candidateId, error)
    }
  }

  const summary = {
    checked: eligible.length,
    due: decisions.length,
    byKind,
    sent,
    skipped,
    failed,
    deferredByVolumeGuard: Math.max(0, decisions.length - sent - skipped - failed),
    budget,
  }
  captureServerEvent('cron', 'in_work_review_emails_run', summary)
  return NextResponse.json(summary)
}
