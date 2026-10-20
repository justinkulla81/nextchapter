// Replays Job Search Daily's job selection (src/lib/job-search-daily/build.ts) for the real
// members of the last two sends, against today's board: how many jobs each would get under the
// strict relevance rule alone, and with small markets auto-widened with bridge jobs. Read-only.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/simulate-jsd-jobs.ts
import { prisma } from '../../src/lib/prisma'
import { loadBoardShortlist } from '../../src/lib/jobs/board-shortlist'
import { emailSafeJobs, midLevelInEmails } from '../../src/lib/jobs/mid-level'
import { earlyCareerInEmails } from '../../src/lib/jobs/career-stage'
import { boardListingFitBucketFor, emailFitScoringVersion } from '../../src/lib/jobs/email-fit-scoring'

const MAX_JOBS = 3

async function main() {
  const days = await prisma.$queryRaw<{ d: Date }[]>`SELECT DISTINCT date_trunc('day', "sentAt") AS d FROM "JobSearchDailySend" ORDER BY d DESC LIMIT 2`
  for (const { d } of days) {
    const sends = await prisma.jobSearchDailySend.findMany({ where: { sentAt: { gte: d, lt: new Date(d.getTime() + 86_400_000) } }, select: { candidateId: true, sentAt: true } })
    console.log(`\n=== sends on ${d.toISOString().slice(0, 10)}`)
    for (const s of sends) {
      const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: s.candidateId } })
      const user = await prisma.$queryRaw<{ email: string }[]>`SELECT email FROM auth.users WHERE id::text = ${candidate.userId}`
      if ((user[0]?.email ?? '').endsWith('@nextchapter.test')) continue
      const prev = await prisma.jobSearchDailySend.findFirst({ where: { candidateId: s.candidateId, sentAt: { lt: s.sentAt } }, orderBy: { sentAt: 'desc' } })
      const jobsSince = prev ? prev.sentAt : new Date(s.sentAt.getTime() - 7 * 86_400_000)
      const sentJobs = await prisma.jobSearchDailyItem.count({ where: { candidateId: s.candidateId, itemKey: { startsWith: 'job:' }, shownAt: { gte: new Date(s.sentAt.getTime() - 15 * 60_000), lte: new Date(s.sentAt.getTime() + 15 * 60_000) } } })
      const shown = new Set((await prisma.jobSearchDailyItem.findMany({ where: { candidateId: s.candidateId, shownAt: { lt: new Date(s.sentAt.getTime() - 15 * 60_000) } }, select: { itemKey: true } })).map((i) => i.itemKey))
      const fitScoring = emailFitScoringVersion()
      const shortlist = await loadBoardShortlist({
        candidate,
        isCandidatePlus: true,
        where: { createdAt: { gte: jobsSince } },
        size: 200,
        fitScoring,
        includeMidLevel: midLevelInEmails(),
        includeEarlyCareer: earlyCareerInEmails(),
        autoWidenTo: 60,
      })
      const fitting = emailSafeJobs([...shortlist.open, ...shortlist.locked]).filter((p) => {
        if (shown.has(`job:${p.id}`)) return false
        const b = boardListingFitBucketFor(fitScoring, candidate, p)
        return b === 'strong' || b === 'good'
      })
      // Members had Candidate+ open when these went out (they got jobs); its weekly effort resets, so assume it.
      const openable = fitting
      const strictOnly = openable.filter((p) => !shortlist.breadth.bridges.has(p.id)).slice(0, MAX_JOBS).length
      const withFix = openable.slice(0, MAX_JOBS)
      const bridgesShown = withFix.filter((p) => shortlist.breadth.bridges.has(p.id)).length
      console.log(`${s.candidateId} (${candidate.primaryFunction}, ${candidate.highestLevelReached ?? '-'}) | actually sent ${sentJobs} | strict rule alone ${strictOnly} | with auto-widen ${withFix.length} (${bridgesShown} bridge) | strict relevant in window ${shortlist.breadth.relevantTotal}${shortlist.breadth.autoWidened ? ', auto-widened' : ''}`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
