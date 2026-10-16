import 'server-only'
import type { Organization, OrgWorkspace, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { grantRoleIfMissing } from '@/lib/auth/role-grants'
import { resetDemoInstitution } from '@/lib/higher-ed/demo-seed'
import { DEMO_TENANTS } from '@/lib/higher-ed/demo-tenants'
import { makeRng, type Rng } from './prng'
import { seatMix, sizesFor, type DemoSizes } from './scenarios'
import { COMPANIES, CITIES, FIRST_NAMES, FUNCTIONS, LAST_NAMES, LEVELS, ROLE_TITLES, demoEmail, sampleCandidatePrefix } from './people'

// Fills a demo organization's portals with fictional, deterministic sample data.
//
// Rules, the same for every portal:
//   - every row is flagged isSampleData wherever the table has the column, and the
//     rest are reachable only through rows that are;
//   - nobody real is touched: sample candidates have their own userId prefix;
//   - nothing is emailed: addresses are on a reserved test domain;
//   - sign-in is by an admin-minted link to a sample account, never a shared password.
// Higher ed reuses its own seed (src/lib/higher-ed/demo-seed.ts).

const DAY = 86_400_000

type Db = Prisma.TransactionClient | typeof prisma

interface Ctx {
  org: Organization
  sizes: DemoSizes
  rng: Rng
  now: Date
  /** Auth users created for this demo, kept so deleting the demo can remove them. */
  userIds: string[]
}

async function authUser(ctx: Ctx, email: string, fullName: string): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName, is_demo: true } })
  if (error || !data.user) throw new Error(`Could not create a demo sign-in for ${email}.`)
  ctx.userIds.push(data.user.id)
  return data.user.id
}

/** The pool of sample people the other portals draw from. Created once per organization. */
async function samplePeople(ctx: Ctx): Promise<string[]> {
  const prefix = sampleCandidatePrefix(ctx.org.slug)
  const existing = await prisma.candidateProfile.findMany({ where: { userId: { startsWith: prefix }, isSampleData: true }, select: { id: true } })
  if (existing.length >= ctx.sizes.people) return existing.map((c) => c.id)
  const rows: Prisma.CandidateProfileCreateManyInput[] = []
  for (let i = existing.length; i < ctx.sizes.people; i++) {
    const [city, state] = ctx.rng.pick(CITIES)
    const level = ctx.rng.pick(LEVELS)
    rows.push({
      id: `${ctx.org.slug}_p_${String(i).padStart(3, '0')}`,
      userId: `${prefix}${i}`,
      firstName: ctx.rng.pick(FIRST_NAMES),
      lastName: ctx.rng.pick(LAST_NAMES),
      email: demoEmail(ctx.org.slug, `person-${i}`),
      currentCity: city,
      currentState: state,
      primaryFunction: ctx.rng.pick(FUNCTIONS),
      highestLevelReached: level,
      // Visible to hiring teams and recruiters, the way a real opted-in member would be.
      privacyTier: 'PUBLIC',
      assessmentComplete: true,
      recruiterDatabaseOptIn: true,
      confidentialSearchMode: false,
      registrationCompletedAt: new Date(ctx.now.getTime() - ctx.rng.int(20, 200) * DAY),
      isSampleData: true,
    })
  }
  await prisma.candidateProfile.createMany({ data: rows, skipDuplicates: true })
  return (await prisma.candidateProfile.findMany({ where: { userId: { startsWith: prefix }, isSampleData: true }, select: { id: true } })).map((c) => c.id)
}

// ── Outplacement ────────────────────────────────────────────────────────────
async function seedOutplacement(ctx: Ctx, orgId: string): Promise<void> {
  const { rng, sizes, now, org } = ctx
  const people = await samplePeople(ctx)

  const team: Array<[('ADMIN' | 'VIEWER' | 'FINANCE'), string, string, 'employer_admin' | 'employer_viewer' | 'employer_finance']> = [
    ['ADMIN', 'Alex Rivera', 'op-admin', 'employer_admin'],
    ['VIEWER', 'Sam Okoro', 'op-viewer', 'employer_viewer'],
    ['FINANCE', 'Jo Marsh', 'op-finance', 'employer_finance'],
  ]
  for (const [role, name, kind, grant] of team) {
    const email = demoEmail(org.slug, kind)
    const userId = await authUser(ctx, email, name)
    await prisma.outplacementOrgUser.create({ data: { orgId, role, invitedEmail: email, fullName: name, userId, acceptedAt: now } })
    await grantRoleIfMissing(userId, grant)
  }

  const contract = await prisma.outplacementContract.create({
    data: {
      orgId,
      cohortLabel: `Reduction in force, ${now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
      tier: 'PLUS',
      seatCount: sizes.seats,
      termStartAt: new Date(now.getTime() - 120 * DAY),
      termEndAt: new Date(now.getTime() + 240 * DAY),
      poReference: `PO-${rng.int(10000, 99999)}`,
      status: 'ACTIVE',
      isSampleData: true,
      createdBy: 'demo-seed',
    },
    select: { id: true },
  })

  const mix = seatMix(sizes.seats)
  const rows: Prisma.OutplacementSeatCreateManyInput[] = []
  for (let i = 0; i < sizes.seats; i++) {
    const activated = i < mix.active
    const ended = i >= mix.active + mix.invited
    const person = activated && i < people.length ? people[i] : null
    const enrolled = new Date(now.getTime() - rng.int(10, 110) * DAY)
    rows.push({
      contractId: contract.id,
      invitedEmail: demoEmail(org.slug, `seat-${i}`),
      invitedName: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      status: ended ? 'DEACTIVATED' : activated && person ? 'ACTIVATED' : 'INVITED',
      candidateId: ended ? null : person,
      enrolledAt: enrolled,
      activatedAt: activated && person ? new Date(enrolled.getTime() + rng.int(1, 6) * DAY) : null,
      deactivatedAt: ended ? new Date(now.getTime() - rng.int(2, 30) * DAY) : null,
      placedAt: activated && person && rng.chance(0.28) ? new Date(now.getTime() - rng.int(3, 60) * DAY) : null,
      cohort: i % 2 === 0 ? 'Operations' : 'Corporate',
      shareOutcomeWithEmployer: rng.chance(0.55),
      isSampleData: true,
    })
  }
  await prisma.outplacementSeat.createMany({ data: rows })
}

// ── Coach ───────────────────────────────────────────────────────────────────
async function seedCoach(ctx: Ctx, coachId: string): Promise<void> {
  const { rng, sizes, now, org } = ctx
  const people = await samplePeople(ctx)
  const coach = await prisma.coach.findUniqueOrThrow({ where: { id: coachId }, select: { workEmail: true, fullName: true } })
  const userId = await authUser(ctx, coach.workEmail, coach.fullName)
  await prisma.coach.update({ where: { id: coachId }, data: { userId } })
  await grantRoleIfMissing(userId, 'coach')

  const status = ['ON_TRACK', 'ON_TRACK', 'AT_RISK', 'STALLED'] as const
  const trend = ['IMPROVING', 'IMPROVING', 'STEADY', 'DECLINING'] as const
  const notes = ['Finished the outreach list and booked two conversations.', 'Stuck on the narrative; we rewrote the opening together.', 'Strong mock interview. Needs sharper numbers on impact.', 'Slow week after a rejection. Reset goals to something small.']
  const directives = ['Send five messages by Friday.', 'Rewrite the summary and share it.', 'Practice the two-minute story out loud.', 'Apply to the three roles we shortlisted.']
  const clients = people.slice(0, sizes.clients)
  await prisma.candidateProfile.updateMany({ where: { id: { in: clients } }, data: { coachId, coachDossierConsentedAt: now } })

  const sessions: Prisma.CoachSessionCreateManyInput[] = []
  clients.forEach((candidateId, ci) => {
    const count = rng.int(1, 5)
    for (let s = 0; s < count; s++) {
      const k = (ci + s) % 4
      sessions.push({
        candidateId,
        coachId,
        occurredAt: new Date(now.getTime() - (count - s) * rng.int(5, 9) * DAY),
        durationMinutes: rng.pick([30, 45, 60]),
        notes: notes[k],
        directives: directives[k],
        sessionType: s === 0 ? 'INTAKE' : 'STANDARD',
        dimTargetingStatus: status[k],
        dimTargetingTrend: trend[k],
        dimNetworkingStatus: status[(k + 1) % 4],
        dimNetworkingTrend: trend[(k + 1) % 4],
        dimMotivationStatus: status[(k + 2) % 4],
        dimMotivationTrend: trend[(k + 2) % 4],
        candidateRating: s > 0 && rng.chance(0.7) ? rng.int(4, 5) : null,
      })
    }
  })
  await prisma.coachSession.createMany({ data: sessions })
  void org
}

// ── Hiring team ─────────────────────────────────────────────────────────────
async function seedHiring(ctx: Ctx, employerId: string): Promise<void> {
  const { rng, sizes, now, org } = ctx
  const people = await samplePeople(ctx)
  const email = demoEmail(org.slug, 'hiring')
  const userId = await authUser(ctx, email, 'Talent lead')
  await prisma.employerProfile.update({ where: { id: employerId }, data: { userId, noGhostingCommitmentAccepted: true, noGhostingCommitmentAcceptedAt: now } })
  await grantRoleIfMissing(userId, 'employer_admin')

  const roleIds: string[] = []
  for (let i = 0; i < sizes.roles; i++) {
    const title = ROLE_TITLES[i % ROLE_TITLES.length]
    const r = await prisma.roleProfile.create({
      data: {
        employerId,
        roleTitle: title,
        roleLevel: rng.pick(['Director', 'VP', 'Manager'] as const),
        primaryFunction: rng.pick(FUNCTIONS),
        locationRequirement: rng.pick(['Pittsburgh, PA', 'Columbus, OH', 'Remote'] as const),
        remotePolicy: rng.pick(['Hybrid', 'Remote', 'On site'] as const),
        compMin: 110_000 + i * 8_000,
        compMax: 150_000 + i * 12_000,
        description: `Lead ${title.toLowerCase()} work across a growing team. Fictional role for a demo.`,
        isActive: true,
        isSampleData: true,
      },
      select: { id: true },
    })
    roleIds.push(r.id)
  }

  const statuses = ['VIEWED', 'SAVED', 'INTEREST_EXPRESSED', 'IN_CONVERSATION', 'HIRED', 'PASSED'] as const
  const rows: Prisma.CandidateInteractionCreateManyInput[] = people.slice(0, Math.min(people.length, sizes.roles * 6)).map((candidateId, i) => ({
    employerId,
    candidateId,
    roleId: roleIds[i % roleIds.length],
    status: statuses[i % statuses.length],
    genericMatchScore: rng.int(58, 96),
    workStyleAlignment: rng.int(55, 95),
    situationRelevance: rng.int(55, 95),
    hiredAt: i % statuses.length === 4 ? new Date(now.getTime() - rng.int(5, 40) * DAY) : null,
  }))
  await prisma.candidateInteraction.createMany({ data: rows, skipDuplicates: true })
}

// ── Recruiter firm ──────────────────────────────────────────────────────────
async function seedRecruiter(ctx: Ctx, firmId: string): Promise<void> {
  const { rng, sizes, now, org } = ctx
  const people = await samplePeople(ctx)
  const team: Array<['ADMIN' | 'RECRUITER' | 'COORDINATOR', string, string]> = [
    ['ADMIN', 'Riley Hart', 'rec-admin'],
    ['RECRUITER', 'Devon Cho', 'rec-recruiter'],
    ['COORDINATOR', 'Sage Lindqvist', 'rec-coordinator'],
  ]
  const recruiterIds: string[] = []
  for (const [firmRole, name, kind] of team) {
    const email = demoEmail(org.slug, kind)
    const userId = await authUser(ctx, email, name)
    const r = await prisma.recruiter.create({
      data: { fullName: name, workEmail: email, firmName: org.name, specialty: 'Operations and finance leadership', userId, recruiterFirmId: firmId, firmRole, isSampleData: true },
      select: { id: true },
    })
    recruiterIds.push(r.id)
    await grantRoleIfMissing(userId, 'recruiter')
  }

  const stages = ['REVIEWED', 'SCREENED', 'SUBMITTED', 'INTERVIEWED', 'PLACED', 'PASSED'] as const
  const lead = recruiterIds[1] ?? recruiterIds[0]
  const pool = people.slice(0, sizes.introductions)
  for (let i = 0; i < pool.length; i++) {
    const candidateId = pool[i]
    const consented = i % 5 !== 4
    const intro = await prisma.recruiterCandidateIntroduction.create({
      data: {
        recruiterId: lead,
        candidateId,
        status: consented ? 'CONSENTED' : 'REQUESTED',
        source: 'ADMIN_INTRODUCED',
        requestedAt: new Date(now.getTime() - rng.int(4, 60) * DAY),
        respondedAt: consented ? new Date(now.getTime() - rng.int(1, 30) * DAY) : null,
        consentExpiresAt: consented ? new Date(now.getTime() + 150 * DAY) : null,
      },
      select: { id: true },
    })
    await prisma.recruiterCandidateIntroductionEvent.create({ data: { introductionId: intro.id, event: 'REQUESTED', actor: 'demo-seed' } })
    if (!consented) continue
    await prisma.recruiterCandidateIntroductionEvent.create({ data: { introductionId: intro.id, event: 'CONSENTED', actor: 'demo-seed' } })
    if (i % 2 === 0) {
      const stage = stages[(i / 2) % stages.length]
      const sub = await prisma.recruiterCandidateSubmission.create({
        data: { recruiterId: lead, candidateId, roleTitle: rng.pick(ROLE_TITLES), companyName: rng.pick(COMPANIES), stage, stageUpdatedAt: new Date(now.getTime() - rng.int(1, 25) * DAY) },
        select: { id: true },
      })
      if (stage === 'PLACED') {
        await prisma.recruiterPlacement.create({
          data: { submissionId: sub.id, recruiterId: lead, candidateId, placedAt: new Date(now.getTime() - rng.int(3, 40) * DAY), feeType: 'PERCENTAGE_OF_COMP', feePercentage: 20 },
        })
      }
    }
  }
}

// ── Higher ed ───────────────────────────────────────────────────────────────
// Reuses the existing demo engine. The college is created by it (not by the admin
// create form), so it carries the isSampleData flag its reset logic requires.
export async function seedDemoCollege(org: Organization, sizes: DemoSizes): Promise<string> {
  const base = DEMO_TENANTS.demo
  const tenant = {
    ...base,
    slug: org.slug,
    name: org.name,
    programBrandName: org.brandName ?? `${org.name} Career Network`,
    accentColor: org.accentColor ?? base.accentColor,
    logoUrl: org.logoUrl ?? null,
    domains: org.domain ? [org.domain] : base.domains,
    alumniCount: sizes.alumni,
    memberCount: sizes.alumni,
  }
  const result = await prisma.$transaction((tx) => resetDemoInstitution(tx, new Date(), tenant), { timeout: 120_000, maxWait: 20_000 })
  return result.institutionId
}

// ── Entry points ────────────────────────────────────────────────────────────
export async function seedDemoWorkspace(org: Organization, ws: Pick<OrgWorkspace, 'type' | 'refId'>, db: Db = prisma): Promise<string[]> {
  void db
  if (!ws.refId) return []
  const ctx: Ctx = { org, sizes: sizesFor(org.demoScenario), rng: makeRng(`${org.slug}:${ws.type}`), now: new Date(), userIds: [] }
  try {
    switch (ws.type) {
      case 'OUTPLACEMENT':
        await seedOutplacement(ctx, ws.refId)
        break
      case 'COACH':
        await seedCoach(ctx, ws.refId)
        break
      case 'HIRING':
        await seedHiring(ctx, ws.refId)
        break
      case 'RECRUITER':
        await seedRecruiter(ctx, ws.refId)
        break
      default:
        break
    }
  } catch (error) {
    // Do not leave sample sign-ins behind when the rest of the seed did not finish.
    const admin = createAdminClient()
    for (const id of ctx.userIds) await admin.auth.admin.deleteUser(id).catch(() => null)
    throw error
  }
  return ctx.userIds
}

/** Removes everything a demo organization created: its portal records, sample people and sample sign-ins. */
export async function clearDemoData(org: Organization & { workspaces: OrgWorkspace[] }): Promise<void> {
  if (!org.isDemo) throw new Error('Only a demo organization can be cleared.')
  const stored = (org.features && typeof org.features === 'object' ? (org.features as Record<string, unknown>).demoUserIds : null) as unknown
  const userIds = Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : []

  // Order matters: some tables refer to people or portal records without a cascade, so
  // their rows go first.
  for (const w of org.workspaces) {
    if (!w.refId) continue
    if (w.type === 'HIGHER_ED') {
      await prisma.exclusiveJobPosting.deleteMany({ where: { institutionScopeId: w.refId } })
      await prisma.institution.delete({ where: { id: w.refId } }).catch(() => null)
      await prisma.candidateProfile.deleteMany({ where: { userId: { startsWith: `demo-${org.slug}-` }, isSampleData: true } })
      await prisma.employerProfile.deleteMany({ where: { userId: { startsWith: `demo-${org.slug}-` }, isSampleData: true } })
    }
    if (w.type === 'OUTPLACEMENT') await prisma.outplacementEmployerOrg.delete({ where: { id: w.refId } }).catch(() => null)
    if (w.type === 'COACH') {
      await prisma.coachSession.deleteMany({ where: { coachId: w.refId } })
      await prisma.coach.delete({ where: { id: w.refId } }).catch(() => null)
    }
    if (w.type === 'HIRING') {
      await prisma.candidateInteraction.deleteMany({ where: { employerId: w.refId } })
      await prisma.employerProfile.delete({ where: { id: w.refId } }).catch(() => null)
    }
    if (w.type === 'RECRUITER') {
      await prisma.recruiter.deleteMany({ where: { recruiterFirmId: w.refId, isSampleData: true } })
      await prisma.recruiterFirm.delete({ where: { id: w.refId } }).catch(() => null)
    }
  }
  await prisma.candidateProfile.deleteMany({ where: { userId: { startsWith: sampleCandidatePrefix(org.slug) }, isSampleData: true } })
  if (userIds.length) await prisma.roleGrant.deleteMany({ where: { userId: { in: userIds } } })
  const admin = createAdminClient()
  for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => null)
}
