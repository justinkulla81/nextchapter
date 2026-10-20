// Parity: the board shortlist before the cold-start change (scripts/perf/baseline-cold/,
// origin/main's shared board + classifier, always reading the database) vs now (a cold
// instance starting from the board snapshot when one matches, geography-first placement),
// for real members, compared on ids AND order and on every total the page shows. Read-only
// (members' re-derived sub-functions are never written back).
//
//   ./scripts/perf/make-cold-baseline.sh
//   set -a; . ./.env.local; set +a
//   node --max-old-space-size=8192 --conditions=react-server --import tsx scripts/perf/board-cold-parity.ts [members] [skip]
//
// Each member is checked on the board page's own call (their window, Narrow/Wide as
// saved, the seniority ring), the fresh-jobs view, Wide, a seniority-group filter, and
// the three email paths' windows. A second pass repeats every case warm (both sides'
// in-memory boards held), which is also where the new side's "board unchanged since"
// reuse is exercised.
import { prisma } from '@/lib/prisma'
import { loadBoardShortlist as oldShortlist, postedWithinWhere } from './baseline-cold/board-shortlist'
import { loadBoardShortlist as newShortlist } from '@/lib/jobs/board-shortlist'
import { memberStageWindow, ALL_STAGES_WINDOW } from '@/lib/jobs/career-stage'
import { defaultWorkTypes } from '@/lib/jobs/work-type'
import { boardBreadthFor } from '@/lib/jobs/search-breadth'
import { emailFitScoringVersion } from '@/lib/jobs/email-fit-scoring'
import { midLevelInEmails } from '@/lib/jobs/mid-level'
import { levelsInGroup } from '@/lib/jobs/job-seniority'

type Opts = Parameters<typeof newShortlist>[0]
type Result = Awaited<ReturnType<typeof newShortlist>>

function cases(c: Opts['candidate']): { name: string; opts: Opts }[] {
  const page: Opts = {
    candidate: c,
    isCandidatePlus: true,
    where: {},
    stageWindow: memberStageWindow(c as never),
    seniorityRing: true,
    includeMidLevel: true,
    includeEarlyCareer: true,
    workTypes: defaultWorkTypes(c as never),
    breadth: boardBreadthFor(c as never),
  }
  const email = { candidate: c, isCandidatePlus: true, fitScoring: emailFitScoringVersion(), includeMidLevel: midLevelInEmails() }
  return [
    { name: 'board page', opts: page },
    { name: 'board fresh view', opts: { ...page, view: 'fresh' } },
    { name: 'board wide', opts: { ...page, breadth: 'wide' } },
    { name: 'board VP group', opts: { ...page, where: { level: { in: levelsInGroup('VP') } }, stageWindow: ALL_STAGES_WINDOW, seniorityRing: false } },
    { name: 'email alerts 24h', opts: { ...email, where: postedWithinWhere(24), size: 30 } },
    { name: 'email digest 7d', opts: { ...email, where: postedWithinWhere(7 * 24), size: 30 } },
    { name: 'email daily', opts: { ...email, where: { createdAt: { gte: new Date(Date.now() - 2 * 86_400_000) } }, size: 200 } },
  ]
}

function signature(r: Result) {
  return {
    open: r.open.map((p) => p.id),
    locked: r.locked.map((p) => p.id),
    totals: [r.openTotal, r.lockedTotal, r.freshOpenTotal, r.lowCompetitionOpenTotal],
    countByWorkType: r.countByWorkType,
    countByCompany: [...r.countByCompany].sort(([a], [b]) => (a < b ? -1 : 1)),
    breadth: {
      applied: r.breadth.applied,
      narrowTotal: r.breadth.narrowTotal,
      wideTotal: r.breadth.wideTotal,
      relevantTotal: r.breadth.relevantTotal,
      marketSize: r.breadth.marketSize,
      marketTier: r.breadth.marketTier,
      extrasTotal: r.breadth.extrasTotal,
      goodMoreIds: r.breadth.goodMoreIds,
      autoWidened: r.breadth.autoWidened,
      bridges: [...r.breadth.bridges].sort(([a], [b]) => (a < b ? -1 : 1)),
    },
    dismissHidden: r.dismiss.hidden,
  }
}

async function main() {
  const n = Number(process.argv[2] ?? 8)
  const skip = Number(process.argv[3] ?? 0)
  const raw = await prisma.candidateProfile.findMany({ where: { isSampleData: false }, orderBy: { createdAt: 'desc' }, take: n, skip })
  // subFunction undefined: neither side writes a re-derived sub-function back.
  const members = raw.map((c) => ({ ...c, subFunction: undefined }) as unknown as Opts['candidate'])
  let checks = 0
  let mismatches = 0
  for (const pass of ['cold', 'warm']) {
    for (const c of members) {
      for (const k of cases(c)) {
        const t = performance.now()
        const a = signature(await oldShortlist(k.opts as never))
        const tOld = performance.now() - t
        const b = signature(await newShortlist(k.opts))
        const tNew = performance.now() - t - tOld
        checks++
        const id = (c as { id: string }).id.slice(-6)
        const timing = `old ${Math.round(tOld)} ms, new ${Math.round(tNew)} ms`
        if (JSON.stringify(a) === JSON.stringify(b)) {
          console.log(`ok   ${pass} ${id} ${k.name.padEnd(18)} ${String(a.open.length).padStart(3)} jobs (${a.totals[0]} total)  ${timing}`)
          continue
        }
        mismatches++
        const diff = Object.keys(a).filter((key) => JSON.stringify(a[key as keyof typeof a]) !== JSON.stringify(b[key as keyof typeof b]))
        const first = a.open.findIndex((x, i) => x !== b.open[i])
        const shown = (x: typeof a) => JSON.stringify(diff.filter((key) => key !== 'open' && key !== 'locked' && key !== 'countByCompany').map((key) => x[key as keyof typeof x]))
        console.log(`DIFF ${pass} ${id} ${k.name}: ${diff.join(', ')}${first >= 0 ? ` (open differs from #${first}: ${a.open[first]} vs ${b.open[first]})` : ''} old ${shown(a)} new ${shown(b)}`)
      }
    }
  }
  console.log(`\n${checks} comparisons, ${mismatches} mismatches`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
