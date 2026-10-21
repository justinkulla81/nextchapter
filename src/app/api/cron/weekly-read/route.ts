import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCronRun } from '@/lib/cron/run'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { loadMarketRealityBrief } from '@/lib/reports/market-reality-brief/load'
import { buildWeeklyChange, readStateOf } from '@/lib/reports/market-reality-brief/weekly-change'
import { hasReadState, previousReadState, saveReadState } from '@/lib/reports/market-reality-brief/read-state-store'
import { firstStep } from '@/lib/reports/market-reality-brief/launchpad'
import { sendWeeklyReadEmail } from '@/lib/email/send-weekly-read-email'

export const maxDuration = 300

// How many members one run builds a full read for. Each build is a full report load, so this is
// the cost knob. Members are taken in a per-week shuffled order so a large base is covered fairly.
const BATCH = 60

// Tuesday afternoon, after Monday's snapshot. OFF unless WEEKLY_READ_EMAIL_ENABLED=true: it does
// nothing, builds nothing and sends nothing until that is set.
//
// Who: members who have opened the Market Reality Report before (so there is a saved read to
// compare with), are not opted out of weekly emails, and are not on the MINIMAL tier. Members who
// already have this week's read saved have opened the report this week and seen the change, so they
// are skipped. An email goes out only when something actually moved.
export const GET = withCronRun('weekly-read', async () => {
  if (process.env.WEEKLY_READ_EMAIL_ENABLED !== 'true') return NextResponse.json({ skipped: 'disabled' })

  const weekStart = getMondayOfWeek(new Date())
  const candidates = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null },
      isSampleData: false,
      weeklyReportOptedOut: false,
      marketRealityReadStates: { some: {} },
    },
    select: { id: true, userId: true, firstName: true, notificationTier: true },
  })
  const seed = weekStart.toISOString()
  const hash = (id: string) => [...(id + seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const ordered = candidates.filter((c) => shouldSendWeeklyExtraForTier(c.notificationTier)).sort((a, b) => hash(a.id) - hash(b.id))

  let built = 0
  let sent = 0
  let skipped = 0
  for (const c of ordered) {
    if (built >= BATCH) break
    try {
      if (await hasReadState(c.id, weekStart)) {
        skipped += 1
        continue
      }
      const [profile, report] = await Promise.all([
        prisma.candidateProfile.findUniqueOrThrow({ where: { id: c.id } }),
        prisma.marketRealityReport.findFirst({ where: { candidateId: c.id }, orderBy: { generatedAt: 'desc' }, select: { resumeRewrites: true, jobSearchPattern: true, strengths: true } }),
      ])
      const brief = await loadMarketRealityBrief(profile, {
        resumeRewrites: report?.resumeRewrites ?? null,
        jobSearchPattern: report?.jobSearchPattern ?? null,
        documentStrengths: report?.strengths ?? null,
        suggestedActions: [],
      })
      built += 1
      const prev = await previousReadState(c.id, weekStart)
      const curr = readStateOf(brief)
      await saveReadState(c.id, weekStart, curr)
      if (!prev) continue
      const change = buildWeeklyChange(prev.state, curr, brief.hiringCase, prev.weekStartDate.toISOString())
      if (!change.hasChange) continue
      const next = firstStep(brief.launchpad)
      const result = await sendWeeklyReadEmail(c, change, next ? { title: next.title, href: next.href } : null)
      if (result.sent) sent += 1
    } catch (error) {
      console.error('Weekly read failed for candidate', c.id, error)
    }
  }
  return NextResponse.json({ eligible: ordered.length, built, sent, skipped })
})
