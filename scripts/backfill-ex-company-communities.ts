// Community rework Phase 4 — syncAutoJoinedCommunities only runs on a
// candidate's next community/page.tsx visit. For every CandidateProfile
// that already had layoffCohortId set before this build shipped, that match
// happened silently (no Community/CommunityMembership row, no auto-join
// banner). This is a one-time sweep to backfill those rows retroactively so
// those candidates get the same explicit "You've been added to: Ex-X" notice
// as anyone matched going forward.
//
// Run: npm run backfill:ex-company-communities -- --dry-run   (count only)
//      npm run backfill:ex-company-communities                 (apply)

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const candidates = await prisma.candidateProfile.findMany({
    where: { layoffCohortId: { not: null } },
    select: { id: true, layoffCohortId: true, layoffCohort: { select: { companyName: true } } },
  })

  const missing = []
  for (const candidate of candidates) {
    if (!candidate.layoffCohortId || !candidate.layoffCohort) continue
    const existing = await prisma.communityMembership.findFirst({
      where: { candidateId: candidate.id, community: { type: 'EX_COMPANY' } },
    })
    if (!existing) missing.push(candidate)
  }

  console.log(`Scanned ${candidates.length} candidates with a layoff cohort, found ${missing.length} missing a Community membership.`)
  for (const candidate of missing) {
    console.log(`  ${candidate.id} — Ex-${candidate.layoffCohort!.companyName}`)
  }

  if (dryRun) {
    console.log('Dry run — no changes made. Re-run without --dry-run to backfill these rows.')
    return
  }

  for (const candidate of missing) {
    const companyName = candidate.layoffCohort!.companyName
    const community = await prisma.community.upsert({
      where: { type_value: { type: 'EX_COMPANY', value: companyName } },
      create: {
        type: 'EX_COMPANY',
        value: companyName,
        label: `Ex-${companyName}`,
        layoffCohortId: candidate.layoffCohortId!,
      },
      update: {},
    })
    await prisma.communityMembership.create({
      data: { communityId: community.id, candidateId: candidate.id, joinedVia: 'AUTO' },
    })
  }
  console.log(`Backfilled ${missing.length} memberships.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
