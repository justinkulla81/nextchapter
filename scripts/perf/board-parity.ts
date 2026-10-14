// Parity: the board shortlist before this change (scripts/perf/baseline/, a copy of
// origin/main's board-shortlist + fit scorer, reading the wide table) vs now, for real
// members (isSampleData=false), compared on ids AND order. Read-only.
//
//   set -a; . ./.env.local; set +a
//   BASELINE_SORT=1 node --conditions=react-server --import tsx scripts/perf/board-parity.ts [members]
//
// BASELINE_SORT=1 sorts the baseline's rows by id as the new code does; without it the
// baseline keeps Postgres storage order, so exact ties can fall differently — the
// script then reports whether every difference is a tie (identical sort keys).
import { prisma } from '@/lib/prisma'
import { loadBoardShortlist as oldShortlist, postedWithinWhere } from './baseline/board-shortlist'
import { loadBoardShortlist as newShortlist } from '@/lib/jobs/board-shortlist'
import { emailFitScoringVersion } from '@/lib/jobs/email-fit-scoring'
import { midLevelRelevantFor } from '@/lib/jobs/mid-level'
import { defaultWorkTypes } from '@/lib/jobs/work-type'
import { levelsInGroup } from '@/lib/jobs/job-seniority'

type Opts = Parameters<typeof newShortlist>[0]
async function main() {
  const n = Number(process.argv[2] ?? 10)
  const only = process.argv[3] // run just the cases whose name starts with this
  const members = await prisma.candidateProfile.findMany({ where: { isSampleData: false }, orderBy: { createdAt: 'desc' }, take: n })
  let checks = 0
  let mismatches = 0
  for (const c of members) {
    const plus = Math.random() < 0.5
    const cases: { name: string; old: Opts; now: Opts }[] = [
      { name: 'board default', old: { candidate: c, isCandidatePlus: plus, where: {}, includeMidLevel: midLevelRelevantFor(c), workTypes: defaultWorkTypes(c) }, now: { candidate: c, isCandidatePlus: plus, where: {}, includeMidLevel: midLevelRelevantFor(c), workTypes: defaultWorkTypes(c) } },
      { name: 'board fresh view', old: { candidate: c, isCandidatePlus: !plus, where: {}, view: 'fresh', includeMidLevel: true, workTypes: ['full_time', 'contract'] }, now: { candidate: c, isCandidatePlus: !plus, where: {}, view: 'fresh', includeMidLevel: true, workTypes: ['full_time', 'contract'] } },
      { name: 'board seniority=VP group', old: { candidate: c, isCandidatePlus: plus, where: { level: { in: levelsInGroup('VP') } }, includeMidLevel: false, view: 'low_competition' }, now: { candidate: c, isCandidatePlus: plus, where: { level: { in: levelsInGroup('VP') } }, includeMidLevel: false, view: 'low_competition' } },
      { name: 'coach view', old: { candidate: c, isCandidatePlus: plus }, now: { candidate: c, isCandidatePlus: plus } },
      { name: 'skill gaps', old: { candidate: c, isCandidatePlus: plus, size: 20 }, now: { candidate: c, isCandidatePlus: plus, size: 20 } },
      { name: 'fresh-jobs prompt', old: { candidate: c, isCandidatePlus: plus, where: postedWithinWhere(72), view: 'fresh', size: 3 }, now: { candidate: c, isCandidatePlus: plus, postedWithinHours: 72, view: 'fresh', size: 3 } },
      { name: 'email (fresh alerts shape)', old: { candidate: c, isCandidatePlus: plus, where: postedWithinWhere(48), size: 30, fitScoring: emailFitScoringVersion() }, now: { candidate: c, isCandidatePlus: plus, where: postedWithinWhere(48), size: 30, fitScoring: emailFitScoringVersion() } },
    ]
    for (const k of cases) {
      if (only && !k.name.startsWith(only)) continue
      // The email paths still read the wide table in storage order, as before; compare
      // them against the baseline in storage order too.
      const sortSetting = process.env.BASELINE_SORT
      if (k.name.startsWith('email')) process.env.BASELINE_SORT = '0'
      const a = await oldShortlist(k.old as never)
      process.env.BASELINE_SORT = sortSetting
      const b = await newShortlist(k.now)
      const ids = (x: typeof a) => [...x.open.map((p) => p.id), '|', ...x.locked.map((p) => p.id)]
      const same = JSON.stringify(ids(a)) === JSON.stringify(ids(b))
      const totals = (x: typeof a) => [x.openTotal, x.lockedTotal, x.freshOpenTotal, x.lowCompetitionOpenTotal, JSON.stringify(x.countByWorkType), x.countByCompany.size]
      const sameTotals = JSON.stringify(totals(a)) === JSON.stringify(totals(b))
      checks++
      if (!same || !sameTotals) {
        mismatches++
        const ia = ids(a), ib = ids(b)
        const firstDiff = ia.findIndex((id, i) => id !== ib[i])
        console.log(`MISMATCH ${c.id.slice(-6)} ${k.name}: ids ${same ? 'same' : `differ from #${firstDiff} (${ia[firstDiff]} vs ${ib[firstDiff]})`}; totals ${sameTotals ? 'same' : JSON.stringify([totals(a), totals(b)])}`)
      } else {
        console.log(`ok ${c.id.slice(-6)} ${k.name}: ${a.open.length}+${a.locked.length} jobs, totals ${a.openTotal}/${a.lockedTotal}`)
      }
    }
  }
  console.log(`\n${checks} comparisons, ${mismatches} mismatches (BASELINE_SORT=${process.env.BASELINE_SORT ?? '0'})`)
  await prisma.$disconnect()
}
main()
