/**
 * One-time backfill: link every pre-existing WarnNotice to a Company via
 * matchOrCreateCompanyForEmployer, same logic new notices get at ingestion
 * time (see stageNotice in src/lib/warn/sync.ts). Run once after the
 * companyId/companyMatchStatus columns were added.
 *
 * Usage: npx tsx --env-file=.env.local scripts/backfill-warn-company-match.ts
 */
import { prisma } from '../src/lib/prisma'
import { matchOrCreateCompanyForEmployer } from '../src/lib/warn/company-match'

async function main() {
  const notices = await prisma.warnNotice.findMany({
    where: { companyMatchStatus: 'UNMATCHED', companyId: null },
    select: { id: true, employer: true },
  })
  console.log(`${notices.length} notices to match.`)

  let matched = 0
  let ambiguous = 0
  let unmatched = 0

  for (const [i, n] of notices.entries()) {
    const result = await matchOrCreateCompanyForEmployer(n.employer)
    await prisma.warnNotice.update({
      where: { id: n.id },
      data: {
        companyId: result.companyId,
        companyMatchStatus: result.status,
        ...(result.candidates ? { companyMatchCandidates: result.candidates } : {}),
      },
    })
    if (result.status === 'MATCHED') matched++
    else if (result.status === 'AMBIGUOUS') ambiguous++
    else unmatched++

    if ((i + 1) % 100 === 0) console.log(`${i + 1}/${notices.length}…`)
  }

  console.log(`Done. Matched/created: ${matched}, ambiguous (needs review): ${ambiguous}, unmatched: ${unmatched}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
