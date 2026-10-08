import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { PLATFORM_DIRECTORY, PLATFORM_CATEGORY_LABEL, getPlatform, platformsForSenderDomain } from '@/lib/platforms/directory'
import { STAGE_LABEL, STAGE_ORDER, type PlatformStageKey } from '@/lib/platforms/stages'
import { platformStatus } from '@/lib/platforms/candidate-view'

export const metadata = { title: 'Work & Learning Engagement' }
export const maxDuration = 30

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

// Which candidates signed up, got accepted, are working or finished, by
// platform — read from the platforms' own emails in connected inboxes
// (src/lib/platforms/). Stage only; email subjects stay with the candidate.
export default async function PlatformEngagementPage() {
  await requireAdmin()

  const [rows, listings, courses, recent] = await Promise.all([
    prisma.candidatePlatformActivity.findMany({
      where: { dismissedAt: null },
      select: { candidateId: true, platformKey: true, kind: true, stage: true, health: true, lastProgressAt: true, firstSeenAt: true },
    }),
    prisma.interimListing.findMany({ where: { isActive: true }, select: { url: true } }),
    prisma.course.findMany({ where: { isActive: true }, select: { url: true } }),
    prisma.candidatePlatformEvent.findMany({
      where: { stage: { not: null, notIn: ['SIGNED_UP'] } },
      orderBy: { emailAt: 'desc' },
      take: 40,
      select: { id: true, candidateId: true, platformKey: true, stage: true, emailAt: true, candidate: { select: { firstName: true, lastName: true } } },
    }),
  ])

  const onSite = new Set<string>()
  for (const { url } of [...listings, ...courses]) {
    const host = hostOf(url)
    if (host) for (const p of platformsForSenderDomain(host)) if (!p.gate) onSite.add(p.key)
  }

  const now = new Date()
  type Agg = { candidates: number; byStage: Partial<Record<PlatformStageKey, number>>; quiet: number }
  const byPlatform = new Map<string, Agg>()
  const candidatesAny = new Set<string>()
  const totals = { workSignedUp: 0, workAccepted: 0, workWorking: 0, learnEnrolled: 0, learnLearning: 0, learnCompleted: 0, quiet: 0 }
  for (const r of rows) {
    candidatesAny.add(r.candidateId)
    const agg = byPlatform.get(r.platformKey) ?? { candidates: 0, byStage: {}, quiet: 0 }
    agg.candidates++
    const stage = r.stage as PlatformStageKey
    agg.byStage[stage] = (agg.byStage[stage] ?? 0) + 1
    const status = platformStatus(r, now)
    if (status.healthLabel === 'Gone quiet') { agg.quiet++; totals.quiet++ }
    byPlatform.set(r.platformKey, agg)
    const rank = STAGE_ORDER[r.kind].indexOf(stage)
    if (r.kind === 'WORK') {
      totals.workSignedUp++
      if (rank >= STAGE_ORDER.WORK.indexOf('ACCEPTED')) totals.workAccepted++
      if (rank >= STAGE_ORDER.WORK.indexOf('WORKING')) totals.workWorking++
    } else {
      if (rank >= STAGE_ORDER.LEARNING.indexOf('ENROLLED')) totals.learnEnrolled++
      if (rank >= STAGE_ORDER.LEARNING.indexOf('LEARNING')) totals.learnLearning++
      if (stage === 'COMPLETED') totals.learnCompleted++
    }
  }

  const platformRows = [...byPlatform.entries()]
    .map(([key, agg]) => ({ key, platform: getPlatform(key), ...agg }))
    .filter((r) => r.platform)
    .sort((a, b) => b.candidates - a.candidates)
  const notOnSite = platformRows.filter((r) => !onSite.has(r.key))

  const tiles: [string, number][] = [
    ['Candidates with any detection', candidatesAny.size],
    ['Work: signed up', totals.workSignedUp],
    ['Work: accepted', totals.workAccepted],
    ['Work: working or paid', totals.workWorking],
    ['Learning: enrolled', totals.learnEnrolled],
    ['Learning: active', totals.learnLearning],
    ['Learning: completed', totals.learnCompleted],
    ['Gone quiet', totals.quiet],
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Work & learning engagement</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Read from each platform&apos;s own emails in candidates&apos; connected Gmail. {PLATFORM_DIRECTORY.length} platforms are tracked
          (fractional work, expert networks, boards, outplacement, government training, courses, certificates, degrees, bootcamps);
          the site lists only the curated ones. Counts are per candidate-platform pair, excluding detections a candidate removed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, n]) => (
          <div key={label} className="rounded-lg border border-border p-3">
            <p className="text-2xl font-semibold tabular-nums">{n}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">By platform</h2>
        {platformRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing detected yet. Detections appear as connected inboxes sync (hourly).</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Platform</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium tabular-nums">Candidates</th>
                  <th className="px-3 py-2 font-medium">By stage</th>
                  <th className="px-3 py-2 font-medium tabular-nums">Gone quiet</th>
                </tr>
              </thead>
              <tbody>
                {platformRows.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      {r.platform!.name}
                      {!onSite.has(r.key) && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Not on site</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{PLATFORM_CATEGORY_LABEL[r.platform!.category]}</td>
                    <td className="px-3 py-2 tabular-nums">{r.candidates}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {STAGE_ORDER[r.platform!.kind]
                        .filter((s) => r.byStage[s])
                        .map((s) => `${STAGE_LABEL[s]} ${r.byStage[s]}`)
                        .join(' · ')}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.quiet || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {notOnSite.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Used by candidates, not on the site</h2>
          <p className="text-sm text-muted-foreground">
            Candidates found these on their own. Add the ones worth recommending under{' '}
            <Link href="/support/admin/interim-listings" className="text-primary underline underline-offset-4">Interim listings</Link> or{' '}
            <Link href="/support/admin/courses" className="text-primary underline underline-offset-4">Courses</Link>.
          </p>
          <p className="text-sm">{notOnSite.map((r) => `${r.platform!.name} (${r.candidates})`).join(', ')}</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Latest progress</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No progress emails yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <Link href={`/support/admin/candidates/${e.candidateId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {[e.candidate.firstName, e.candidate.lastName].filter(Boolean).join(' ') || 'Candidate'}
                  </Link>{' '}
                  · {getPlatform(e.platformKey)?.name ?? e.platformKey} · {STAGE_LABEL[e.stage as PlatformStageKey]}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{e.emailAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
