// Demo-tenant seed. Each demo tenant is a fixture in ./demo-tenants.ts
// (Demo College at /i/demo, plus sales demos such as a named college); this
// file turns one into rows. A small first cut for HE-03; HE-12 grows it to
// the full §10 seed (200 members, the hero alum, the WARN notice, 400 gifts,
// employer, outcomes).
//
// Members, staff and gifts are always fictional and isSampleData = true; a
// fixture's profile carries only public, sourced facts. Reset deletes the demo
// Institution (every child row cascades) and seeds again. Deterministic:
// the same run produces the same people, so screenshots stay comparable.

import 'server-only'
import { createHash } from 'crypto'
import type { InstitutionAffiliation, InstitutionMemberStatus, Prisma, PrismaClient, TransitionFlagSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { DEMO_TENANTS, type DemoTenant } from './demo-tenants'

type Db = PrismaClient | Prisma.TransactionClient

export const DEMO_SLUG = 'demo'

const FIRST = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Rowan', 'Harper', 'Emerson', 'Finley', 'Sawyer', 'Reese', 'Dakota', 'Hayden', 'Parker', 'Logan', 'Elliot', 'Blair', 'Cameron', 'Drew']
const LAST = ['Abernathy', 'Bellweather', 'Castellano', 'Drummond', 'Ellsworth', 'Fairbanks', 'Galloway', 'Hollister', 'Iverson', 'Kincaid', 'Lockhart', 'Merriweather', 'Northcott', 'Oakridge', 'Pemberton', 'Quillfeather', 'Ravensworth', 'Sterling', 'Thistlewood', 'Underhill']
const TITLES = ['Director of Operations', 'Senior Analyst', 'VP Finance', 'Product Manager', 'Plant Manager', 'Account Executive', 'Nurse Manager', 'Software Engineer', 'Controller', 'Marketing Manager', 'HR Business Partner', 'Teacher']
const DEGREES = ['BA', 'BS']

const FIRST_CLASS = 1975
const LAST_CLASS = 2026

function pick<T>(list: T[], i: number, salt: number): T {
  return list[(i * 7 + salt * 13) % list.length]
}

function fiscalYearDate(fyEndYear: number, i: number): Date {
  // July 1 of fyEndYear-1 through June 30 of fyEndYear (fiscalYearStartMonth 7).
  const start = Date.UTC(fyEndYear - 1, 6, 1)
  const day = (i * 37) % 360
  return new Date(start + day * 86_400_000)
}

export type DemoSeedResult = { institutionId: string; members: number; staff: number; flags: number; gifts: number }

export async function resetDemoInstitution(
  db: Db = prisma,
  now = new Date(),
  tenant: DemoTenant = DEMO_TENANTS[DEMO_SLUG],
): Promise<DemoSeedResult> {
  const slug = tenant.slug
  // Only ever deletes a demo, sample-data institution under this slug. Its
  // alumni-only postings go first: the scope FK is SET NULL, and an unscoped
  // approved posting would land on the open job board.
  const old = await db.institution.findFirst({ where: { slug, isDemo: true, isSampleData: true }, select: { id: true } })
  if (old) await db.exclusiveJobPosting.deleteMany({ where: { institutionScopeId: old.id } })
  await db.institution.deleteMany({ where: { slug, isDemo: true, isSampleData: true } })
  const existing = await db.institution.findUnique({ where: { slug }, select: { id: true } })
  if (existing) throw new Error(`Slug "${slug}" belongs to a non-demo institution; refusing to seed over it.`)

  const institution = await db.institution.create({
    data: {
      slug,
      name: tenant.name,
      programBrandName: tenant.programBrandName,
      accentColor: tenant.accentColor,
      logoUrl: tenant.logoUrl ?? null,
      domains: tenant.domains,
      tier: 'ADVANCEMENT',
      alumniCount: tenant.alumniCount,
      includedSeats: tenant.includedSeats,
      licenseStartAt: new Date(Date.UTC(now.getUTCFullYear(), 6, 1)),
      licenseEndAt: new Date(Date.UTC(now.getUTCFullYear() + 1, 5, 30)),
      givingUrl: tenant.givingUrl,
      enabledFeatures: {
        graceDays: 60,
        fiscalYearStartMonth: 7,
        engagementWeights: {},
        wioa: false,
        ...(tenant.services ? { services: tenant.services } : {}),
        ...(tenant.annualCheckInMonth ? { checkIns: { annualMonth: tenant.annualCheckInMonth } } : {}),
      },
      profile: (tenant.profile ?? undefined) as Prisma.InputJsonValue | undefined,
      isDemo: true,
      isSampleData: true,
    },
    select: { id: true },
  })
  const institutionId = institution.id

  const staff = await Promise.all(
    tenant.staff.map(([role, fullName]) =>
      db.institutionUser.create({
        data: {
          institutionId,
          role,
          fullName,
          invitedEmail: `${role.toLowerCase().replace(/_/g, '-')}@${tenant.staffEmailDomain}`,
          isSampleData: true,
        },
      }),
    ),
  )
  const counselor = staff.find((s) => s.role === 'CAREER_SERVICES')!

  // The college's own coach, in the coach portal (Coach.institutionId).
  // isSampleData keeps them out of every real member's coach matching.
  const coachName = tenant.staff.find(([role]) => role === 'COACH')?.[1]
  if (coachName) {
    const workEmail = `coach@${tenant.staffEmailDomain}`
    await db.coach.upsert({
      where: { workEmail },
      create: {
        fullName: coachName,
        workEmail,
        focus: 'CAREER',
        isSampleData: true,
        institutionId,
        industries: ['Healthcare', 'Energy'],
        seniorityFit: ['Manager', 'Director'],
        certifications: ['ICF'],
        specializationTags: [],
        languages: ['English'],
      },
      update: { fullName: coachName, institutionId, isSampleData: true },
      select: { id: true },
    })
  }

  const memberRows: Prisma.InstitutionMemberCreateManyInput[] = []
  const memberCount = tenant.memberCount ?? 60
  for (let i = 0; i < memberCount; i++) {
    const firstName = pick(FIRST, i, 1)
    const lastName = pick(LAST, i, 3)
    const classYear = FIRST_CLASS + Math.round((i * (LAST_CLASS - FIRST_CLASS)) / (memberCount - 1))
    const affiliation: InstitutionAffiliation = i % 20 === 7 ? 'PARENT' : 'ALUM'
    const status: InstitutionMemberStatus = i % 5 === 0 ? 'INVITED' : 'IMPORTED'
    const employer = classYear >= 2025 ? null : pick(tenant.employers, i, 5)
    memberRows.push({
      id: `${slug}_member_${String(i).padStart(3, '0')}`,
      institutionId,
      externalId: String(100_000 + i),
      email: `${firstName}.${lastName}.${i}@example.com`.toLowerCase(),
      firstName,
      lastName,
      affiliation,
      classYear,
      degree: pick(DEGREES, i, 2),
      major: pick(tenant.majors, i, 4),
      matchMethod: 'ROSTER_EMAIL',
      status,
      doNotContact: i % 23 === 11,
      lastKnownEmployer: employer,
      lastKnownEmployerNormalized: employer ? normalizeOrgName(employer) : null,
      lastKnownTitle: employer ? pick(TITLES, i, 6) : null,
      isSampleData: true,
    })
  }
  await db.institutionMember.createMany({ data: memberRows })
  const memberIds = memberRows.map((m) => m.id!)

  // Ten members turned outcome sharing off, so the directory shows the
  // consent gate: their employer and title come back blank.
  await db.institutionConsent.createMany({
    data: memberIds
      .filter((_, i) => i % 6 === 2)
      .map((memberId) => ({ memberId, scope: 'SHARE_OUTCOME' as const, granted: false, source: 'MEMBER', isSampleData: true })),
  })

  // Eight open transition flags. The reasons are deliberately specific so
  // it's obvious if one ever leaks into a staff view (none should).
  const flagSources: TransitionFlagSource[] = ['SELF_REPORTED', 'COUNSELOR', 'CHECK_IN', 'IMPORT']
  const flagged = [3, 9, 14, 21, 27, 33, 41, 48]
  await db.transitionFlag.createMany({
    data: flagged.map((idx, n) => ({
      memberId: memberIds[idx],
      openFlagMemberId: memberIds[idx],
      state: 'IN_TRANSITION' as const,
      doNotSolicit: true,
      source: flagSources[n % flagSources.length],
      reason: `PRIVATE demo reason ${n + 1}: never shown to staff`,
      startedAt: new Date(now.getTime() - (n + 1) * 9 * 86_400_000),
      isSampleData: true,
    })),
  })

  // Six recent grads on the seeded counselor's caseload, each with an M6
  // check-in. Two share search detail with Career Services.
  const recentGrads = memberRows.filter((m) => (m.classYear ?? 0) >= 2023).slice(0, 6)
  await db.caseloadAssignment.createMany({
    data: recentGrads.map((m) => ({ institutionId, counselorId: counselor.id, memberId: m.id!, isSampleData: true })),
  })
  await db.institutionConsent.createMany({
    data: recentGrads.slice(0, 2).map((m) => ({
      memberId: m.id!,
      scope: 'SHARE_SEARCH_DETAIL_WITH_CAREER' as const,
      granted: true,
      source: 'MEMBER',
      isSampleData: true,
    })),
  })
  await db.checkIn.createMany({
    data: recentGrads.map((m, n) => ({
      memberId: m.id!,
      kind: 'M6' as const,
      dueAt: new Date(now.getTime() + (n + 1) * 7 * 86_400_000),
      isSampleData: true,
    })),
  })

  // Gifts across the last two fiscal years, plus the import run they came in on.
  const fyEnd = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()
  const run = await db.crmExchangeRun.create({
    data: {
      institutionId,
      direction: 'IMPORT_GIFTS',
      fileName: 'demo-gifts.csv',
      status: 'SUCCEEDED',
      createdBy: 'demo-seed',
      completedAt: now,
      isSampleData: true,
    },
  })
  const gifts: Prisma.InstitutionGiftCreateManyInput[] = []
  memberRows.forEach((m, i) => {
    if (i % 3 === 1) return
    for (const fy of [fyEnd - 1, fyEnd]) {
      if (fy === fyEnd && i % 4 === 0) continue
      const giftDate = fiscalYearDate(fy, i)
      if (giftDate > now) continue
      const amountCents = (25 + ((i * 41) % 20) * 25) * 100
      const fund = i % 2 ? 'Annual Fund' : 'Scholarship Fund'
      const appeal = i % 3 ? 'Spring Appeal' : 'Giving Day'
      gifts.push({
        institutionId,
        memberId: m.id!,
        externalConstituentId: m.externalId!,
        amountCents,
        giftDate,
        fund,
        appeal,
        dedupeKey: createHash('sha256').update([m.externalId, giftDate.toISOString().slice(0, 10), amountCents, fund, appeal].join('|')).digest('hex'),
        importRunId: run.id,
        isSampleData: true,
      })
    }
  })
  await db.institutionGift.createMany({ data: gifts })
  await db.crmExchangeRun.update({ where: { id: run.id }, data: { rowCount: gifts.length } })

  // Some engagement so the directory's 12-month points column has values.
  const events: Prisma.EngagementEventCreateManyInput[] = []
  memberRows.forEach((m, i) => {
    if (i % 4 !== 0) return
    for (let k = 0; k < 1 + (i % 3); k++) {
      events.push({
        institutionId,
        memberId: m.id!,
        type: k === 0 ? 'OUTREACH_CLICK' : 'EVENT',
        caseCategory: k === 0 ? 'COMMUNICATION' : 'EXPERIENTIAL',
        points: k === 0 ? 1 : 3,
        occurredAt: new Date(now.getTime() - (i + k * 30) * 86_400_000),
        sourceTable: 'demo-seed',
        sourceId: `${m.id}-${k}`,
        isSampleData: true,
      })
    }
  })
  await db.engagementEvent.createMany({ data: events })

  await db.resilienceFund.create({
    data: {
      institutionId,
      name: `${tenant.name} Resilience Fund`,
      description: 'Covers coaching and premium seats for alumni between jobs.',
      goalCents: 25_000_000,
      raisedCents: 8_400_000,
      isSampleData: true,
    },
  })

  return { institutionId, members: memberRows.length, staff: staff.length, flags: flagged.length, gifts: gifts.length }
}
