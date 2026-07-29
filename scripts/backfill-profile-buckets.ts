// One-time backfill: populates the normalized bucket/index fields added in
// the resume-derived-profile-data work (industryBucket, metroArea,
// companyNameNormalized, schoolNameNormalized) for candidates/rows that
// existed before those fields did. Idempotent — safe to re-run; only
// touches rows where the normalized field is currently empty/null.
//
// Run: npm run backfill:profile-buckets

import { PrismaClient } from '@prisma/client'
import { normalizeIndustryBucket } from '../src/lib/constants/industry-buckets'
import { normalizeMetroArea } from '../src/lib/constants/metro-areas'
import { normalizeOrgName } from '../src/lib/text/org-name-match'

const prisma = new PrismaClient()

async function backfillCandidateProfiles() {
  const candidates = await prisma.candidateProfile.findMany({
    where: { OR: [{ industryBucket: null }, { metroArea: null }] },
    select: { id: true, industryContext: true, currentCity: true },
  })

  let updated = 0
  for (const candidate of candidates) {
    const industryBucket = normalizeIndustryBucket(candidate.industryContext)
    const metroArea = normalizeMetroArea(candidate.currentCity)
    if (!industryBucket && !metroArea) continue

    await prisma.candidateProfile.update({
      where: { id: candidate.id },
      data: { industryBucket, metroArea },
    })
    updated++
  }
  console.log(`CandidateProfile: backfilled ${updated} of ${candidates.length} candidates missing a bucket.`)
}

async function backfillWorkHistory() {
  const rows = await prisma.workHistoryEntry.findMany({
    where: { companyNameNormalized: '' },
    select: { id: true, companyName: true },
  })

  for (const row of rows) {
    await prisma.workHistoryEntry.update({
      where: { id: row.id },
      data: { companyNameNormalized: normalizeOrgName(row.companyName) },
    })
  }
  console.log(`WorkHistoryEntry: backfilled companyNameNormalized for ${rows.length} rows.`)
}

async function backfillEducation() {
  const rows = await prisma.educationEntry.findMany({
    where: { schoolNameNormalized: '' },
    select: { id: true, schoolName: true },
  })

  for (const row of rows) {
    await prisma.educationEntry.update({
      where: { id: row.id },
      data: { schoolNameNormalized: normalizeOrgName(row.schoolName) },
    })
  }
  console.log(`EducationEntry: backfilled schoolNameNormalized for ${rows.length} rows.`)
}

async function main() {
  await backfillCandidateProfiles()
  await backfillWorkHistory()
  await backfillEducation()
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
