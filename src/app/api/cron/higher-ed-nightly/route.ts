import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clearEndedGrace } from '@/lib/higher-ed/transition'
import { matchLayoffs } from '@/lib/higher-ed/layoffs'
import { syncEngagement } from '@/lib/higher-ed/engagement'
import { scheduleCheckIns } from '@/lib/higher-ed/checkins'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'
import { runMonthlyEmails } from '@/lib/higher-ed/monthly'

export const maxDuration = 300

// Higher Ed nightly (spec §6.3, §6.2, §7, §6.6). Idempotent, so a rerun adds
// nothing:
//   • flags whose post-placement grace has ended clear, and where the alum
//     said the college helped, the gratitude ask goes to Development;
//   • new WARN notices are matched to alumni employers (staff approve the email);
//   • engagement events are synced from what alumni did in NextChapter;
//   • check-ins that came due are scheduled (staff approve the send);
//   • the monthly alumni email goes out where a college switched it on.
// Demo colleges are skipped: their data comes from the demo seed.
export const GET = withCronRun('higher-ed-nightly', async () => {
  const startedAt = new Date()
  const grace = await clearEndedGrace(startedAt)
  const colleges = await prisma.institution.findMany({ where: { isDemo: false }, select: { id: true } })
  const totals = { layoffMatches: 0, engagementEvents: 0, checkInsScheduled: 0, failed: 0 }
  for (const c of colleges) {
    try {
      totals.layoffMatches += (await matchLayoffs(c.id, startedAt)).added
      totals.engagementEvents += (await syncEngagement(c.id, startedAt)).added
      totals.checkInsScheduled += (await scheduleCheckIns(c.id, startedAt)).scheduled
    } catch (err) {
      totals.failed++
      console.error('[higher-ed-nightly]', c.id, err)
    }
  }
  // The monthly alumni email, for colleges that switched it on (batched).
  const monthly = await runMonthlyEmails(startedAt).catch((err) => {
    console.error('[higher-ed-nightly] monthly email', err)
    return []
  })
  const result = { ...grace, ...totals, colleges: colleges.length, monthlySent: monthly.reduce((n, m) => n + m.sent, 0) }
  captureServerEvent('cron', 'he_nightly_ran', { ...result, ms: Date.now() - startedAt.getTime() })
  return NextResponse.json({ ok: true, ...result })
})
