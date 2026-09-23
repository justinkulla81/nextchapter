/**
 * Mirrors every real candidate into the CRM as a CrmPerson, on the
 * membership-upgrade pipeline.
 *
 *   npm run crm:sync-candidates              # dry run
 *   npm run crm:sync-candidates -- --commit
 *
 * One-time backfill for candidates who signed up before this sync existed.
 * Going forward, new candidates are synced as they complete onboarding (see
 * src/lib/crm/candidate-sync.ts's own callers) — this script exists to catch
 * up the ones who predate that hook, and is safe to re-run any time (it's
 * the same idempotent syncCandidateToCrm under the hood).
 *
 * Sample/system/test candidates are skipped — see CandidateProfile's own
 * isSampleData/isSystemAccount fields.
 */
import { prisma } from '../../src/lib/prisma'
import { syncCandidateToCrm } from '../../src/lib/crm/candidate-sync'

const COMMIT = process.argv.includes('--commit')

async function main() {
  console.log(`CANDIDATE → CRM SYNC — ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)

  const candidates = await prisma.candidateProfile.findMany({
    where: { isSampleData: false, isSystemAccount: false },
    select: { id: true },
  })
  console.log(`${candidates.length} real candidates to check.\n`)

  if (!COMMIT) {
    console.log('Dry run — nothing written. Re-run with --commit.')
    return
  }

  let created = 0
  let linked = 0
  let opportunitiesCreated = 0
  let opportunitiesAdvanced = 0
  let skipped = 0

  for (const c of candidates) {
    const result = await syncCandidateToCrm(c.id)
    if (!result) { skipped++; continue }
    if (result.personCreated) created++
    else linked++
    if (result.opportunityCreated) opportunitiesCreated++
    if (result.opportunityAdvanced) opportunitiesAdvanced++
  }

  console.log(`CrmPerson created      : ${created}`)
  console.log(`CrmPerson already there: ${linked}`)
  console.log(`Skipped (no name/email): ${skipped}`)
  console.log(`Opportunities created  : ${opportunitiesCreated}`)
  console.log(`Opportunities advanced : ${opportunitiesAdvanced}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
