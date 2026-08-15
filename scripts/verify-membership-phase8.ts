// Phase 8 verification — Partners Master Build Script §A2.4 (Membership) and
// §A4 (Alumni Benefits Network). Run with: npm run verify:membership-phase8
//
// Same convention as scripts/verify-hiring-phase7.ts: a raw PrismaClient
// (not @/lib/prisma or any 'server-only'-guarded lib module — every lib
// module this phase added carries that guard, and importing one from a
// plain node/tsx script throws immediately, see node_modules/server-only/
// index.js) — deliberately reimplements the same operations those modules
// perform (grant a RoleGrant, create a MembershipSubscription, flip a
// listing LISTED, filter by status+expiresAt) as independent raw-Prisma
// calls, so this doesn't share a bug with the code it's checking, and never
// triggers a real email send. All rows created here are deleted at the end
// — never touches real seeded profiles.
//
// Live browser verification was blocked this session (another chat's dev
// server holds the Next.js lock on this repo's .next directory even on an
// alternate port) — this is the substitute verification path.

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const prisma = new PrismaClient()

let failures = 0
function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS  ${message}`)
  } else {
    failures++
    console.error(`  FAIL  ${message}`)
  }
}

async function main() {
  console.log('\n1. Plan catalog — Membership pricing is live and matches §A2.4')
  const monthly = await prisma.planCatalogEntry.findFirst({
    where: { planKey: 'membership_monthly', active: true },
    orderBy: { effectiveDate: 'desc' },
  })
  const annual = await prisma.planCatalogEntry.findFirst({
    where: { planKey: 'membership_annual', active: true },
    orderBy: { effectiveDate: 'desc' },
  })
  assert(monthly?.priceCents === 1900, `membership_monthly is $19/mo (got ${monthly?.priceCents} cents)`)
  assert(annual?.priceCents === 18000, `membership_annual is $180/yr (got ${annual?.priceCents} cents)`)

  console.log('\n2. RoleGrantRole enum carries alum/member')
  const enumRows = (await prisma.$queryRaw`SELECT unnest(enum_range(NULL::"RoleGrantRole"))::text AS v`) as { v: string }[]
  const enumValues = enumRows.map((r) => r.v)
  assert(enumValues.includes('alum'), 'RoleGrantRole includes alum')
  assert(enumValues.includes('member'), 'RoleGrantRole includes member')

  console.log('\n3. Alum + free-Premium-Membership activation — schema/relations exercised end-to-end')
  const testUserId = `phase8-test-user-${Date.now()}`
  const candidate = await prisma.candidateProfile.create({
    data: { userId: testUserId, firstName: 'Phase8', lastName: 'Verify', email: `phase8-verify-${Date.now()}@example.com` },
  })

  // Mirrors grantRoleIfMissing's "only if no active grant exists" behavior.
  async function grantRoleIfMissing(userId: string, role: 'alum' | 'member') {
    const existing = await prisma.roleGrant.findFirst({ where: { userId, role, revokedAt: null } })
    if (!existing) await prisma.roleGrant.create({ data: { userId, role } })
  }

  await grantRoleIfMissing(testUserId, 'alum')
  const alumGrant = await prisma.roleGrant.findFirst({ where: { userId: testUserId, role: 'alum', revokedAt: null } })
  assert(!!alumGrant, 'alum RoleGrant created')

  const premiumSeat = await prisma.outplacementSeat.findFirst({
    where: { candidateId: candidate.id, contract: { tier: 'PREMIUM' } },
  })
  assert(premiumSeat === null, 'no Premium outplacement seat yet — auto-Membership should NOT fire')

  const org = await prisma.outplacementEmployerOrg.create({
    data: { name: 'Phase8 Test Org', primaryContactEmail: 'contact@phase8testorg.example', isSampleData: true },
  })
  const contract = await prisma.outplacementContract.create({
    data: {
      orgId: org.id,
      tier: 'PREMIUM',
      seatCount: 1,
      termStartAt: new Date(),
      termEndAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdBy: 'phase8-verify-script',
    },
  })
  const seat = await prisma.outplacementSeat.create({
    data: { contractId: contract.id, invitedEmail: candidate.email!, candidateId: candidate.id, status: 'ACTIVATED' },
  })

  const premiumSeatNow = await prisma.outplacementSeat.findFirst({
    where: { candidateId: candidate.id, contract: { tier: 'PREMIUM' } },
  })
  assert(!!premiumSeatNow, 'Premium outplacement seat now detected — this is activateAlumStatus\'s real gating query')

  const freeUntil = new Date()
  freeUntil.setMonth(freeUntil.getMonth() + 12)
  await prisma.membershipSubscription.create({
    data: {
      candidateId: candidate.id,
      planKey: 'membership_monthly',
      status: 'ACTIVE',
      source: 'FREE_PREMIUM_PLACEMENT',
      freeUntil,
      currentPeriodEnd: freeUntil,
    },
  })
  await grantRoleIfMissing(testUserId, 'member')
  const subscription = await prisma.membershipSubscription.findUnique({ where: { candidateId: candidate.id } })
  assert(subscription?.status === 'ACTIVE', 'MembershipSubscription unique-on-candidateId create succeeds')
  const memberGrant = await prisma.roleGrant.findFirst({ where: { userId: testUserId, role: 'member', revokedAt: null } })
  assert(!!memberGrant, 'member RoleGrant created')

  console.log('\n4. Benefits Network listing + institutional-email verification — schema/relations exercised end-to-end')
  const listing = await prisma.benefitsNetworkListing.create({
    data: {
      alumId: candidate.id,
      institutionName: 'Phase8 Test University',
      programName: 'Test Certificate',
      description: 'A test program.',
      fullCostNote: 'Free — no cost.',
      discountDescription: '100% off',
      seatCount: 5,
      redemptionMethod: 'CODE',
      redemptionValue: 'TESTCODE',
      redemptionInstructions: 'Use at checkout.',
      function: 'Finance',
      level: 'Any level',
      format: 'Self-paced',
      costType: 'Free',
      timeCommitment: 'Under 5 hours',
      credentialType: 'Certificate',
      skillGapTags: ['Financial modeling'],
      status: 'PENDING_VERIFICATION',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      reviewDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  })
  assert(listing.status === 'PENDING_VERIFICATION', 'listing starts PENDING_VERIFICATION, not visible in catalog')

  const verification = await prisma.benefitsNetworkVerification.create({
    data: {
      listingId: listing.id,
      institutionEmail: 'staff@phase8testuniversity.edu',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  })
  assert(!!verification.token, 'verification token created (this is what gets emailed)')

  // Mirrors confirmBenefitsNetworkVerification's transaction exactly.
  const domain = verification.institutionEmail.split('@')[1]
  await prisma.$transaction([
    prisma.benefitsNetworkVerification.update({ where: { id: verification.id }, data: { confirmedAt: new Date() } }),
    prisma.benefitsNetworkListing.update({ where: { id: listing.id }, data: { status: 'LISTED', institutionDomain: domain } }),
  ])
  const listingAfter = await prisma.benefitsNetworkListing.findUniqueOrThrow({ where: { id: listing.id } })
  assert(listingAfter.status === 'LISTED', 'listing flips to LISTED after confirmation')
  assert(listingAfter.institutionDomain === 'phase8testuniversity.edu', 'institutionDomain set from the confirmed email')

  console.log('\n5. Catalog query shape — real listing appears, and expiry enforcement works')
  // Mirrors getCatalogListings' WHERE clause exactly.
  async function catalogQuery(fn: string) {
    return prisma.benefitsNetworkListing.findMany({
      where: { status: 'LISTED', expiresAt: { gt: new Date() }, function: fn },
    })
  }
  const catalog = await catalogQuery('Finance')
  assert(
    catalog.some((l) => l.id === listing.id),
    'newly-listed offer appears in the Finance-filtered catalog query'
  )

  await prisma.benefitsNetworkListing.update({ where: { id: listing.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  const catalogAfterExpiry = await catalogQuery('Finance')
  assert(
    !catalogAfterExpiry.some((l) => l.id === listing.id),
    'expired offer no longer appears in the catalog query (real-time enforcement, not just a stored date)'
  )

  console.log('\n6. Dossier — Benefits Network completion is a distinct model, and the hard no-scoring rule holds')
  const completion = await prisma.benefitsNetworkCompletion.create({ data: { listingId: listing.id, candidateId: candidate.id } })
  assert(!!completion.id, 'BenefitsNetworkCompletion is its own model, not a LearningBadge row')

  const dossierSectionsSrc = readFileSync(join(__dirname, '../src/lib/reports/dossier-sections.ts'), 'utf-8')
  assert(
    dossierSectionsSrc.includes('benefitsNetworkCompletion') && dossierSectionsSrc.includes('getLearningGrowth'),
    'dossier-sections.ts (Learning & Growth section) reads BenefitsNetworkCompletion'
  )

  const dossierCompetenciesSrc = readFileSync(join(__dirname, '../src/lib/scoring/dossier-competencies.ts'), 'utf-8')
  assert(
    !dossierCompetenciesSrc.includes('BenefitsNetworkCompletion') && !dossierCompetenciesSrc.includes('benefitsNetworkCompletion'),
    'dossier-competencies.ts (the 5-competency grid / grade computation) never references BenefitsNetworkCompletion'
  )

  console.log('\n7. Cleanup — deleting all rows this script created')
  await prisma.benefitsNetworkCompletion.deleteMany({ where: { candidateId: candidate.id } })
  await prisma.benefitsNetworkVerification.deleteMany({ where: { listingId: listing.id } })
  await prisma.benefitsNetworkListing.deleteMany({ where: { id: listing.id } })
  await prisma.membershipSubscription.deleteMany({ where: { candidateId: candidate.id } })
  await prisma.outplacementSeat.delete({ where: { id: seat.id } })
  await prisma.outplacementContract.delete({ where: { id: contract.id } })
  await prisma.outplacementEmployerOrg.delete({ where: { id: org.id } })
  await prisma.roleGrant.deleteMany({ where: { userId: testUserId } })
  await prisma.candidateProfile.delete({ where: { id: candidate.id } })
  console.log('  done')

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
  .catch((error) => {
    console.error('Verification script crashed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
