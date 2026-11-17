import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clearEndedGrace } from '@/lib/higher-ed/transition'
import { matchLayoffs } from '@/lib/higher-ed/layoffs'
import { syncEngagement } from '@/lib/higher-ed/engagement'
import { scheduleCheckIns } from '@/lib/higher-ed/checkins'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'
import { runMonthlyEmails } from '@/lib/higher-ed/monthly'
import { cleanupExpiredDemos, reseedWorkforceDemo } from '@/lib/workforce/demo'
import { autoJoinMajorGroups } from '@/lib/higher-ed/major-groups'
import { DEMO_TENANTS } from '@/lib/higher-ed/demo-tenants'
import { resetDemoInstitution } from '@/lib/higher-ed/demo-seed'
import { seedDemoContent } from '@/lib/institution/admin'

export const maxDuration = 300

// Higher Ed nightly (spec §6.3, §6.2, §7, §6.6). Idempotent, so a rerun adds
// nothing:
//   • flags whose post-placement grace has ended clear, and where the alum
//     said the college helped, the gratitude ask goes to Development;
//   • new WARN notices are matched to alumni employers (staff approve the email);
//   • engagement events are synced from what alumni did in NextChapter;
//   • check-ins that came due are scheduled (staff approve the send);
//   • the monthly alumni email goes out where a college switched it on;
//   • joined alumni are added to the groups for their major (one statement,
//     every college, no rows returned).
// Demo colleges are skipped: their data comes from the demo seed.
export const GET = withCronRun('higher-ed-nightly', async () => {
  const startedAt = new Date()
  const grace = await clearEndedGrace(startedAt)
  // Public workforce demos older than 30 days.
  const demos = await cleanupExpiredDemos(startedAt).catch(() => ({ removed: 0 }))
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
  // A demo college created as an empty placeholder (a demo, sample-data row under a fixture's slug, with no members yet) is
  // filled from its fixture, once: the same reset as Admin > Institutions > Reset to fixture. Never touches a seeded demo.
  const demosFilled = await fillEmptyDemoPlaceholders().catch((err) => {
    console.error('[higher-ed-nightly] demo placeholders', err)
    return [] as string[]
  })
  // Catches members whose major arrived with a later roster import. A member who left a group is never re-added.
  const majorGroupJoins = await autoJoinMajorGroups().catch((err) => {
    console.error('[higher-ed-nightly] major groups', err)
    return 0
  })
  const result = { ...grace, ...totals, majorGroupJoins, demosFilled: demosFilled.length, colleges: colleges.length, monthlySent: monthly.reduce((n, m) => n + m.sent, 0), demosRemoved: demos.removed }
  captureServerEvent('cron', 'he_nightly_ran', { ...result, ms: Date.now() - startedAt.getTime() })
  return NextResponse.json({ ok: true, ...result })
})

async function fillEmptyDemoPlaceholders(): Promise<string[]> {
  const rows = await prisma.institution.findMany({
    where: { slug: { in: Object.keys(DEMO_TENANTS) }, isDemo: true, isSampleData: true, members: { none: {} } },
    select: { slug: true },
  })
  const filled: string[] = []
  for (const { slug } of rows) {
    const result = await prisma.$transaction((tx) => resetDemoInstitution(tx, new Date(), DEMO_TENANTS[slug]), { timeout: 120_000, maxWait: 20_000 })
    await seedDemoContent(result.institutionId, 'demo-placeholder')
    captureServerEvent('cron', 'institution_demo_reset', { institutionId: result.institutionId, slug, members: result.members, source: 'nightly_placeholder' })
    filled.push(slug)
  }
  // A workforce or economic development demo row with a region and no people yet (one NextChapter set up by hand): seed it
  // the way the demo generator does, keeping its name, region and address. At most a few a night.
  const workforce = await prisma.institution.findMany({
    where: { isDemo: true, isSampleData: true, orgType: { not: 'COLLEGE' }, members: { none: {} } },
    select: { slug: true },
    take: 5,
  })
  for (const { slug } of workforce) {
    const r = await reseedWorkforceDemo(slug)
    if ('ok' in r) {
      captureServerEvent('cron', 'institution_demo_reset', { slug, source: 'nightly_placeholder', kind: 'workforce' })
      filled.push(slug)
    } else console.error('[higher-ed-nightly] workforce demo placeholder', slug, r.error)
  }
  return filled
}
