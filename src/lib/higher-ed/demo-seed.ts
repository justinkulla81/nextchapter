// Demo-tenant seed (spec §10, HE-12). Each demo tenant is a fixture in
// ./demo-tenants.ts (Demo College at /i/demo, plus sales demos such as a
// named college); this file turns one into rows so every screen has a story:
//
//   200 alumni across 1975–2026, 60 joined (with every journey: laid off,
//   ready to move, thinking about a move, promotion, career change, ...);
//   the hero alum (imported, not joined) at a company with a real WARN
//   notice, plus two classmates there; two fiscal years of gifts where users'
//   giving rises more than matched non-users', so lift renders; 12 mentors
//   in 6 industries with this month's requests; an approved, featured
//   alum-led employer with 2 roles and a pending one; a caseload of 15
//   recent grads with M6/M18 check-ins (one said "starting to look");
//   6 outcome reports (2 thank-you asks pending, 1 VP promotion signal);
//   Resilience Fund awards; Dossier sharers and an intro request.
//
// Fictional people, staff, gifts and employers, every row isSampleData. The
// one real thing is the layoff: a recent public WARN filing the seed points
// at but never writes to (WARN notices feed public pages and the CRM, so a
// fictional one would leak). No Company or MemberEmployment rows are created,
// so nothing fictional reaches company pages; employers live on the roster.
//
// Reset deletes the demo Institution (children cascade), its sample
// candidate and employer profiles, and seeds again. Deterministic: the same
// day produces the same people, so screenshots stay comparable.

import 'server-only'
import { createHash } from 'crypto'
import type {
  CheckInKind,
  CheckInStatus,
  InstitutionAffiliation,
  InstitutionMemberStatus,
  JourneyStage,
  JourneyType,
  Prisma,
  PrismaClient,
  TransitionFlagSource,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { getJourney } from '@/lib/journey/journey'
import { DEMO_TENANTS, type DemoTenant } from './demo-tenants'
import { mentorCallRows } from './engagement'
import { clearEndedGrace } from './transition'

type Db = PrismaClient | Prisma.TransactionClient

export const DEMO_SLUG = 'demo'
const DAY = 86_400_000

const FIRST = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Rowan', 'Harper', 'Emerson', 'Finley', 'Sawyer', 'Reese', 'Dakota', 'Hayden', 'Parker', 'Logan', 'Elliot', 'Blair', 'Cameron', 'Drew']
const LAST = ['Abernathy', 'Bellweather', 'Castellano', 'Drummond', 'Ellsworth', 'Fairbanks', 'Galloway', 'Hollister', 'Iverson', 'Kincaid', 'Lockhart', 'Merriweather', 'Northcott', 'Oakridge', 'Pemberton', 'Quillfeather', 'Ravensworth', 'Sterling', 'Thistlewood', 'Underhill']
const TITLES = ['Director of Operations', 'Senior Analyst', 'VP Finance', 'Product Manager', 'Plant Manager', 'Account Executive', 'Nurse Manager', 'Software Engineer', 'Controller', 'Marketing Manager', 'HR Business Partner', 'Teacher']
const DEGREES = ['BA', 'BS']
const MENTOR_FIELDS = ['Finance', 'Healthcare', 'Technology', 'Consulting', 'Manufacturing and energy', 'Law']
// Why joined alumni are here: not only job loss.
const JOURNEY_CYCLE: JourneyType[] = ['LAID_OFF', 'READY_TO_MOVE', 'EXPLORING_MOVE', 'LAID_OFF', 'PROMOTION', 'EXPLORING_MOVE', 'CAREER_CHANGE', 'READY_TO_MOVE', 'LAID_OFF', 'EXPLORING_MOVE', 'PROMOTION', 'STUDENT_NEW_GRAD']
const STAGE_FOR: Partial<Record<JourneyType, JourneyStage[]>> = {
  LAID_OFF: ['APPLYING', 'INTERVIEWING', 'APPLYING'],
  READY_TO_MOVE: ['PREPARING', 'APPLYING', 'INTERVIEWING'],
  EXPLORING_MOVE: ['EXPLORING'],
  PROMOTION: ['PREPARING'],
  CAREER_CHANGE: ['EXPLORING', 'PREPARING'],
}
const DOSSIER_LINES = [
  'Operations leader who has run three plant turnarounds; looking for a COO-track role in regional manufacturing.',
  'Healthcare finance analyst moving into FP&A; strongest at turning messy data into a budget people trust.',
  'Product manager with B2B SaaS launches; wants a mission-driven company in Pittsburgh or remote.',
  'Account executive who rebuilt a territory from zero to 140% of quota; open to sales leadership.',
]

const FIRST_CLASS = 1975
const LAST_CLASS = 2026

function pick<T>(list: readonly T[], i: number, salt: number): T {
  return list[(i * 7 + salt * 13) % list.length]
}

// Deterministic 0..1 per (i, salt).
function rand(i: number, salt: number): number {
  const h = createHash('sha256').update(`${i}:${salt}`).digest()
  return h.readUInt32BE(0) / 0xffffffff
}

function fiscalStart(now: Date, offset = 0): Date {
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  return new Date(Date.UTC(y + offset, 6, 1))
}

// A date inside [from, to), placed by r in 0..1.
const between = (from: Date, to: Date, r: number) => new Date(from.getTime() + Math.floor((to.getTime() - from.getTime()) * Math.min(Math.max(r, 0), 0.999)))

export type DemoSeedResult = { institutionId: string; members: number; joined: number; staff: number; flags: number; gifts: number; mentors: number; layoffMatches: number }

// Profiles the seed owns, by user id prefix. Never a real login.
const sampleUserPrefix = (slug: string) => `demo-${slug}-`

export async function resetDemoInstitution(db: Db = prisma, now = new Date(), tenant: DemoTenant = DEMO_TENANTS[DEMO_SLUG]): Promise<DemoSeedResult> {
  const slug = tenant.slug
  // Only ever deletes a demo, sample-data institution under this slug. Its
  // alumni-only postings go first: the scope FK is SET NULL, and an unscoped
  // approved posting would land on the open job board.
  const old = await db.institution.findFirst({ where: { slug, isDemo: true, isSampleData: true }, select: { id: true } })
  if (old) await db.exclusiveJobPosting.deleteMany({ where: { institutionScopeId: old.id } })
  await db.institution.deleteMany({ where: { slug, isDemo: true, isSampleData: true } })
  await db.candidateProfile.deleteMany({ where: { userId: { startsWith: sampleUserPrefix(slug) }, isSampleData: true } })
  await db.employerProfile.deleteMany({ where: { userId: { startsWith: sampleUserPrefix(slug) }, isSampleData: true } })
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
        data: { institutionId, role, fullName, invitedEmail: `${role.toLowerCase().replace(/_/g, '-')}@${tenant.staffEmailDomain}`, isSampleData: true },
      }),
    ),
  )
  const counselor = staff.find((s) => s.role === 'CAREER_SERVICES')!

  // The college's own coach, in the coach portal (Coach.institutionId).
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

  // The layoff: a real recent WARN filing, preferring the college's state.
  const state = tenant.profile?.region?.state ?? tenant.profile?.college?.state ?? null
  const recent = { dismissedAt: null, noticeDate: { gte: new Date(now.getTime() - 150 * DAY), lte: now }, employees: { gte: 25 } }
  const notice =
    (state ? await db.warnNotice.findFirst({ where: { ...recent, state }, orderBy: { noticeDate: 'desc' }, select: { id: true, employer: true, companyId: true } }) : null) ??
    (await db.warnNotice.findFirst({ where: recent, orderBy: { noticeDate: 'desc' }, select: { id: true, employer: true, companyId: true } }))

  // ── Members ──────────────────────────────────────────────────────────────
  const n = tenant.memberCount ?? 200
  const isJoined = (i: number) => [1, 4, 8].includes(i % 10)
  const isParent = (i: number) => i % 20 === 7
  const dnc = (i: number) => i % 23 === 11
  const classOf = (i: number) => FIRST_CLASS + Math.round((i * (LAST_CLASS - FIRST_CLASS)) / (n - 1))
  const firstAfter = (from: number, ok: (i: number) => boolean) => {
    for (let i = Math.floor(from); i < n; i++) if (ok(i)) return i
    return -1
  }
  // The featured alum (what "Preview as alum" shows) and the hero (imported,
  // at the WARN company), both mid-career.
  const featured = firstAfter(n * 0.68, (i) => isJoined(i) && !isParent(i))
  const hero = firstAfter(n * 0.565, (i) => !isJoined(i) && !isParent(i) && !dnc(i))
  const atWarn = new Set(notice ? [hero, firstAfter(hero + 1, (i) => !isJoined(i) && !isParent(i) && !dnc(i)), firstAfter(n * 0.76, (i) => !isJoined(i) && !isParent(i) && !dnc(i))] : [])
  const employerCo = tenant.employers[4]

  const idOf = (i: number) => (i === featured ? `${slug}_member_featured` : i === hero ? `${slug}_member_hero` : `${slug}_member_${String(i).padStart(3, '0')}`)
  const joinedIdx: number[] = []
  const memberRows: Prisma.InstitutionMemberCreateManyInput[] = []
  for (let i = 0; i < n; i++) {
    const firstName = pick(FIRST, i, 1)
    const lastName = pick(LAST, i, 3)
    const classYear = classOf(i)
    const affiliation: InstitutionAffiliation = isParent(i) ? 'PARENT' : classYear > now.getUTCFullYear() ? 'STUDENT' : 'ALUM'
    const joined = isJoined(i) && !isParent(i)
    if (joined) joinedIdx.push(i)
    const status: InstitutionMemberStatus = joined ? 'CLAIMED' : i % 5 === 0 ? 'INVITED' : 'IMPORTED'
    const employer = atWarn.has(i) && notice ? notice.employer : classYear >= now.getUTCFullYear() - 1 ? null : pick(tenant.employers, i, 5)
    memberRows.push({
      id: idOf(i),
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
      claimedAt: joined ? new Date(now.getTime() - (40 + ((i * 13) % 300)) * DAY) : null,
      isActiveSeat: joined && i % 3 !== 0,
      seatActivatedAt: joined && i % 3 !== 0 ? new Date(now.getTime() - (30 + ((i * 13) % 280)) * DAY) : null,
      doNotContact: dnc(i),
      lastKnownEmployer: employer,
      lastKnownEmployerNormalized: employer ? normalizeOrgName(employer) : null,
      lastKnownTitle: i === hero ? 'Director of Operations' : employer ? pick(TITLES, i, 6) : null,
      isSampleData: true,
    })
  }
  await db.institutionMember.createMany({ data: memberRows })
  const row = (i: number) => memberRows[i]
  const mid = (i: number) => idOf(i)

  // Joined alumni: a sample candidate profile each, with a journey.
  const journeyOf = new Map<number, JourneyType>()
  const candidateRows: Prisma.CandidateProfileCreateManyInput[] = joinedIdx.map((i, k) => {
    const journey = i === featured ? 'READY_TO_MOVE' : (row(i).classYear ?? 0) >= now.getUTCFullYear() - 2 ? 'STUDENT_NEW_GRAD' : JOURNEY_CYCLE[k % JOURNEY_CYCLE.length]
    journeyOf.set(i, journey)
    const stage = STAGE_FOR[journey]?.[k % (STAGE_FOR[journey]?.length ?? 1)] ?? getJourney(journey).defaultStage
    return {
      id: `${slug}_cand_${String(i).padStart(3, '0')}`,
      userId: `${sampleUserPrefix(slug)}${i}`,
      firstName: row(i).firstName,
      lastName: row(i).lastName,
      journey,
      journeyStage: stage,
      journeyChangedAt: row(i).claimedAt as Date,
      journeyStageChangedAt: row(i).claimedAt as Date,
      currentJobStatus: getJourney(journey).jobStatus,
      positioningStatementText: k % 7 === 0 || i === featured ? pick(DOSSIER_LINES, k, 1) : null,
      isSampleData: true,
    }
  })
  await db.candidateProfile.createMany({ data: candidateRows })
  for (const c of candidateRows) {
    const i = Number(c.id!.slice(-3))
    await db.institutionMember.update({ where: { id: mid(i) }, data: { candidateId: c.id } })
  }
  const candidateOf = (i: number) => `${slug}_cand_${String(i).padStart(3, '0')}`

  // Consent: most share by default. Some turn outcome or engagement sharing
  // off (the directory shows the gate); Dossier sharers opted in; a few
  // share search detail with Career Services.
  const dossierSharers = candidateRows.filter((c) => c.positioningStatementText).map((c) => Number(c.id!.slice(-3)))
  const consents: Prisma.InstitutionConsentCreateManyInput[] = [
    ...memberRows.filter((_, i) => i % 6 === 2).map((m) => ({ memberId: m.id!, scope: 'SHARE_OUTCOME' as const, granted: false, source: 'MEMBER', isSampleData: true })),
    ...joinedIdx.filter((i) => i % 13 === 5).map((i) => ({ memberId: mid(i), scope: 'SHARE_ENGAGEMENT' as const, granted: false, source: 'MEMBER', isSampleData: true })),
    ...dossierSharers.map((i) => ({ memberId: mid(i), scope: 'SHARE_DOSSIER_WITH_EMPLOYERS' as const, granted: true, source: 'MEMBER', isSampleData: true })),
  ]
  await db.institutionConsent.createMany({ data: consents })

  // ── Transition flags ─────────────────────────────────────────────────────
  // Eight laid-off alumni in transition. Reasons are deliberately specific so
  // it's obvious if one ever leaks into a staff view (none should).
  const laidOff = joinedIdx.filter((i) => journeyOf.get(i) === 'LAID_OFF')
  const flagged = laidOff.slice(0, 8)
  const flagSources: TransitionFlagSource[] = ['SELF_REPORTED', 'COUNSELOR', 'CHECK_IN', 'SELF_REPORTED']
  await db.transitionFlag.createMany({
    data: flagged.map((i, k) => ({
      memberId: mid(i),
      openFlagMemberId: mid(i),
      state: 'IN_TRANSITION' as const,
      doNotSolicit: true,
      source: flagSources[k % flagSources.length],
      reason: `PRIVATE demo reason ${k + 1}: never shown to staff`,
      startedAt: new Date(now.getTime() - (k + 1) * 9 * DAY),
      isSampleData: true,
    })),
  })

  // ── Outcomes: six who landed ─────────────────────────────────────────────
  // Two past their quiet period with a thank-you ask pending, one in grace
  // (the "advance time" control clears it), one VP promotion, two more.
  const landed = [...laidOff.slice(8, 11), ...joinedIdx.filter((i) => journeyOf.get(i) === 'PROMOTION').slice(0, 1), ...laidOff.slice(11, 13)].slice(0, 6)
  const vp = landed[3]
  for (const [k, i] of landed.entries()) {
    const placedAt = new Date(now.getTime() - [95, 80, 40, 30, 20, 10][k] * DAY)
    const grace = new Date(placedAt.getTime() + 60 * DAY)
    const cleared = grace < now
    await db.transitionFlag.create({
      data: {
        memberId: mid(i),
        openFlagMemberId: cleared ? null : mid(i),
        state: cleared ? 'CLEARED' : 'PLACED_GRACE',
        doNotSolicit: !cleared,
        source: 'SELF_REPORTED',
        startedAt: new Date(placedAt.getTime() - 70 * DAY),
        placedAt,
        graceEndsAt: grace,
        clearedAt: cleared ? grace : null,
        isSampleData: true,
      },
    })
    await db.outcomeReport.create({
      data: {
        memberId: mid(i),
        reportedAt: placedAt,
        helpedByInstitution: k !== 4,
        shareMilestone: k !== 5,
        gratitudeStatus: cleared && k < 2 ? 'PENDING' : 'NONE',
        isSampleData: true,
      },
    })
    const newEmployer = pick(tenant.employers, i, 9)
    await db.institutionMember.update({
      where: { id: mid(i) },
      data: { lastKnownEmployer: newEmployer, lastKnownEmployerNormalized: normalizeOrgName(newEmployer), lastKnownTitle: i === vp ? 'VP Operations' : pick(TITLES, i, 8) },
    })
    await db.candidateProfile.update({ where: { id: candidateOf(i) }, data: { journeyStage: 'LANDED', journeyStageChangedAt: placedAt } })
  }
  if (vp !== undefined) {
    await db.prospectFlag.createMany({
      data: (['PROMOTION_VP_PLUS', 'NEW_EMPLOYER_MATCHING_GIFT'] as const).map((type) => ({ institutionId, memberId: mid(vp), type, detectedAt: new Date(now.getTime() - 29 * DAY), isSampleData: true })),
    })
  }

  // ── Caseload and check-ins ───────────────────────────────────────────────
  // Fifteen recent grads on the counselor's caseload with M6/M18 check-ins:
  // some sent, some answered (one "starting to look"), some waiting for
  // approval. Plus this year's annual check-in, waiting for Alumni Relations.
  const grads = memberRows.map((m, i) => ({ m, i })).filter(({ m }) => m.affiliation === 'ALUM' && (m.classYear ?? 0) >= now.getUTCFullYear() - 4).slice(-15)
  await db.caseloadAssignment.createMany({ data: grads.map(({ m }) => ({ institutionId, counselorId: counselor.id, memberId: m.id!, isSampleData: true })) })
  await db.institutionConsent.createMany({
    data: grads.filter(({ i }) => isJoined(i)).slice(0, 3).map(({ m }) => ({ memberId: m.id!, scope: 'SHARE_SEARCH_DETAIL_WITH_CAREER' as const, granted: true, source: 'MEMBER', isSampleData: true })),
  })
  let lookingMember: string | null = null
  const checkIns: Prisma.CheckInCreateManyInput[] = grads.map(({ m }, k) => {
    const kind: CheckInKind = (m.classYear ?? 0) >= now.getUTCFullYear() ? 'M6' : 'M18'
    const status: CheckInStatus = k < 4 ? 'SCHEDULED' : k < 11 ? 'SENT' : 'RESPONDED'
    const dueAt = new Date(now.getTime() - (k < 4 ? 2 : 20 + k) * DAY)
    const answer = status === 'RESPONDED' ? (k === 11 ? 'looking' : 'good') : null
    if (answer === 'looking') lookingMember = m.id!
    return {
      memberId: m.id!,
      kind,
      dueAt,
      status,
      sentAt: status === 'SCHEDULED' ? null : new Date(dueAt.getTime() + DAY),
      respondedAt: answer ? new Date(dueAt.getTime() + 3 * DAY) : null,
      responseJson: answer ? { answer } : undefined,
      isSampleData: true,
    }
  })
  await db.checkIn.createMany({ data: checkIns })
  if (lookingMember) {
    await db.transitionFlag.create({
      data: { memberId: lookingMember, openFlagMemberId: lookingMember, state: 'IN_TRANSITION', doNotSolicit: true, source: 'CHECK_IN', startedAt: new Date(now.getTime() - 15 * DAY), isSampleData: true },
    })
  }
  const annualDue = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  await db.checkIn.createMany({
    data: memberRows
      .filter((m, i) => m.affiliation === 'ALUM' && !dnc(i) && (m.classYear ?? 0) < now.getUTCFullYear() - 4 && i % 6 === 0)
      .map((m) => ({ memberId: m.id!, kind: 'CUSTOM' as const, dueAt: annualDue, isSampleData: true })),
  })

  // ── Layoff matches (the hero and two classmates) ─────────────────────────
  if (notice) {
    await db.layoffMatch.createMany({
      data: [...atWarn].map((i, k) => ({ institutionId, warnNoticeId: notice.id, memberId: mid(i), companyId: notice.companyId, matchedAt: new Date(now.getTime() - (k + 1) * DAY), isSampleData: true })),
    })
  }

  // ── Outreach: the join invitation, with clicks and joins ─────────────────
  const welcome = await db.outreachCampaign.create({
    data: {
      institutionId,
      type: 'WELCOME',
      subject: `${tenant.name} has your back: your career toolkit is ready`,
      body: 'Hi {{firstName}}, ... Join in one click: {{link}}',
      createdBy: 'demo-seed',
      sentAt: new Date(now.getTime() - 345 * DAY),
      isSampleData: true,
    },
  })
  await db.outreachSend.createMany({
    data: memberRows
      .filter((m) => m.status !== 'IMPORTED' && !m.doNotContact)
      .map((m, k) => ({
        campaignId: welcome.id,
        memberId: m.id!,
        email: m.email,
        sentAt: new Date(now.getTime() - 345 * DAY),
        clickedAt: m.claimedAt ? new Date((m.claimedAt as Date).getTime() - DAY) : k % 3 === 0 ? new Date(now.getTime() - 300 * DAY) : null,
        claimedAt: m.claimedAt ?? null,
        isSampleData: true,
      })),
  })

  // ── Gifts: three fiscal years ────────────────────────────────────────────
  // Everyone's giving the last two years is the same mix; this year, alumni
  // who joined and used the tools give more than matched alumni who didn't.
  const fy0 = fiscalStart(now)
  const fyLast = fiscalStart(now, -1)
  const fyPrior = fiscalStart(now, -2)
  const users = new Set(joinedIdx.filter((i, k) => k % 4 !== 3))
  const runs = await db.crmExchangeRun.createManyAndReturn({
    data: [
      { institutionId, direction: 'IMPORT_ROSTER' as const, fileName: `${slug}-roster.csv`, rowCount: n, status: 'SUCCEEDED' as const, createdBy: 'demo-seed', startedAt: new Date(now.getTime() - 360 * DAY), completedAt: new Date(now.getTime() - 360 * DAY), isSampleData: true },
      { institutionId, direction: 'IMPORT_GIFTS' as const, fileName: `${slug}-gifts.csv`, status: 'SUCCEEDED' as const, createdBy: 'demo-seed', startedAt: new Date(now.getTime() - 2 * DAY), completedAt: new Date(now.getTime() - 2 * DAY), isSampleData: true },
    ],
    select: { id: true, direction: true },
  })
  const giftRun = runs.find((r) => r.direction === 'IMPORT_GIFTS')!
  const gifts: Prisma.InstitutionGiftCreateManyInput[] = []
  const addGifts = (i: number, from: Date, to: Date, salt: number) => {
    if (to <= from) return
    const count = 1 + (rand(i, salt + 1) < 0.4 ? 1 : 0) + (rand(i, salt + 2) < 0.15 ? 1 : 0)
    for (let g = 0; g < count; g++) {
      const giftDate = between(from, to, rand(i, salt + 10 + g))
      const amountCents = (25 + Math.floor(rand(i, salt + 20 + g) * 20) * 25) * 100
      const fund = rand(i, salt + 30) < 0.5 ? 'Annual Fund' : 'Scholarship Fund'
      const appeal = rand(i, salt + 40 + g) < 0.6 ? 'Spring Appeal' : 'Giving Day'
      const m = row(i)
      gifts.push({
        id: `${slug}_gift_${i}_${salt}_${g}`,
        institutionId,
        memberId: m.id!,
        externalConstituentId: m.externalId!,
        amountCents,
        giftDate,
        fund,
        appeal,
        dedupeKey: createHash('sha256').update([m.externalId, giftDate.toISOString().slice(0, 10), amountCents, fund, appeal].join('|')).digest('hex'),
        importRunId: giftRun.id,
        isSampleData: true,
      })
    }
  }
  const yesterday = new Date(now.getTime() - DAY)
  memberRows.forEach((m, i) => {
    if (m.affiliation !== 'ALUM') return
    const gavePrior = rand(i, 1) < 0.3
    const gaveLast = rand(i, 2) < 0.38
    if (gavePrior) addGifts(i, fyPrior, fyLast, 100)
    if (gaveLast) addGifts(i, fyLast, fy0, 200)
    const joined = isJoined(i)
    const p = users.has(i) ? (gaveLast ? 0.7 : 0.22) : joined ? (gaveLast ? 0.6 : 0.08) : gaveLast ? 0.55 : 0.06
    if (rand(i, 3) < p) {
      // Users' gifts this year come after they joined.
      const from = joined && m.claimedAt && (m.claimedAt as Date) > fy0 ? (m.claimedAt as Date) : fy0
      addGifts(i, from, yesterday, 300)
    }
  })
  await db.institutionGift.createMany({ data: gifts })
  await db.crmExchangeRun.update({ where: { id: giftRun.id }, data: { rowCount: gifts.length } })

  // ── Engagement ───────────────────────────────────────────────────────────
  // What the nightly sync would have written: tool use and logins for users,
  // coaching for some, link clicks, gifts in the last 12 months.
  const optedOutOfEngagement = new Set(joinedIdx.filter((i) => i % 13 === 5))
  const events: Prisma.EngagementEventCreateManyInput[] = []
  const ev = (i: number, type: Prisma.EngagementEventCreateManyInput['type'], caseCategory: Prisma.EngagementEventCreateManyInput['caseCategory'], points: number, occurredAt: Date, sourceId: string) =>
    events.push({ institutionId, memberId: mid(i), type, caseCategory, points, occurredAt, sourceTable: 'demo-seed', sourceId, isSampleData: true })
  for (const i of joinedIdx) {
    if (optedOutOfEngagement.has(i)) continue
    const claimed = row(i).claimedAt as Date
    for (let t = claimed.getTime() + 3 * DAY, w = 0; t < now.getTime(); t += 7 * DAY, w++) {
      if (users.has(i) && w % 2 === 0) ev(i, 'TOOL_USE', 'EXPERIENTIAL', 2, new Date(t), `${i}-tool-${w}`)
      if (w % 2 === 1) ev(i, 'LOGIN', 'COMMUNICATION', 1, new Date(t), `${i}-login-${w}`)
    }
    if (i % 5 === 0) ev(i, 'COACHING_SESSION', 'EXPERIENTIAL', 3, new Date(claimed.getTime() + 20 * DAY), `${i}-coach`)
    ev(i, 'OUTREACH_CLICK', 'COMMUNICATION', 1, new Date(claimed.getTime() - DAY), `${i}-click`)
  }
  const yearAgo = new Date(now.getTime() - 366 * DAY)
  for (const g of gifts) {
    const i = Number(g.id!.split('_gift_')[1].split('_')[0])
    if ((g.giftDate as Date) >= yearAgo) ev(i, 'GIFT', 'PHILANTHROPIC', 10, g.giftDate as Date, g.id!)
  }

  // ── Mentors ──────────────────────────────────────────────────────────────
  // Twelve in six industries, from established alumni who aren't between jobs.
  const mentorIdx = joinedIdx.filter((i) => (row(i).classYear ?? 9999) <= now.getUTCFullYear() - 12 && !flagged.includes(i) && i !== featured).slice(0, 12)
  const mentors = await Promise.all(
    mentorIdx.map((i, k) =>
      db.institutionMentor.create({
        data: { institutionId, memberId: mid(i), industries: [MENTOR_FIELDS[k % 6], ...(k % 3 === 0 ? [MENTOR_FIELDS[(k + 2) % 6]] : [])], maxCallsPerMonth: k % 4 === 0 ? 4 : 2, isSampleData: true },
        select: { id: true, memberId: true },
      }),
    ),
  )
  const requesters = [featured, ...flagged.slice(0, 3)]
  const reqStatus = ['ACCEPTED', 'COMPLETED', 'REQUESTED', 'COMPLETED'] as const
  for (const [k, i] of requesters.entries()) {
    const m = mentors[k % mentors.length]
    if (!m) break
    const requestedAt = new Date(now.getTime() - (k + 2) * DAY)
    const status = reqStatus[k]
    const r = await db.mentorRequest.create({
      data: {
        mentorId: m.id,
        requesterMemberId: mid(i),
        note: ['Thinking about moving into finance and would love your take.', 'Recently laid off; trying to figure out where my skills fit.', 'Interviewing at a hospital system next week.', 'Changing careers into tech.'][k],
        status,
        requestedAt,
        respondedAt: status === 'REQUESTED' ? null : new Date(requestedAt.getTime() + DAY),
        completedAt: status === 'COMPLETED' ? new Date(requestedAt.getTime() + DAY) : null,
        isSampleData: true,
      },
      select: { id: true },
    })
    if (status === 'COMPLETED') for (const e of mentorCallRows(institutionId, r.id, m.memberId, mid(i), new Date(requestedAt.getTime() + DAY))) events.push({ ...e, isSampleData: true })
  }
  await db.engagementEvent.createMany({ data: events, skipDuplicates: true })

  // ── Employers ────────────────────────────────────────────────────────────
  // An alum-led employer, approved and featured, with two roles; a second
  // asking for approval.
  const leader = mentorIdx[0] ?? joinedIdx[0]
  const [approved, pending] = await Promise.all([
    db.employerProfile.create({
      data: { userId: `${sampleUserPrefix(slug)}employer`, companyName: employerCo, companyIndustry: 'Technology', contactName: `${row(leader).firstName} ${row(leader).lastName} ('${String(row(leader).classYear).slice(2)})`, isSampleData: true },
      select: { id: true },
    }),
    db.employerProfile.create({
      data: { userId: `${sampleUserPrefix(slug)}employer-2`, companyName: tenant.employers[7], companyIndustry: 'Insurance', contactName: 'Talent team', isSampleData: true },
      select: { id: true },
    }),
  ])
  await db.institutionEmployer.createMany({
    data: [
      { institutionId, employerProfileId: approved.id, status: 'APPROVED', packageTier: 'FEATURED', featuredUntil: new Date(now.getTime() + 60 * DAY), approvedBy: 'demo-seed', approvedAt: new Date(now.getTime() - 30 * DAY), isSampleData: true },
      { institutionId, employerProfileId: pending.id, status: 'PENDING', isSampleData: true },
    ],
  })
  // A few alumni already work there, so "alumni work here" shows.
  await db.institutionMember.updateMany({
    where: { id: { in: [leader, ...joinedIdx.slice(2, 4)].map(mid) } },
    data: { lastKnownEmployer: employerCo, lastKnownEmployerNormalized: normalizeOrgName(employerCo) },
  })
  await db.exclusiveJobPosting.createMany({
    data: [
      ['Senior Data Analyst', 'Hybrid'],
      ['Customer Success Manager', 'Remote'],
    ].map(([title, location], k) => ({
      title,
      companyName: employerCo,
      location,
      url: `https://example.com/${slug}/roles/${k + 1}`,
      description: `Posted for ${tenant.name} alumni.`,
      postingType: 'direct',
      salaryCurrency: 'USD',
      audienceTier: 'ALL_CANDIDATES',
      distribution: 'OPEN',
      disclosure: 'OPEN',
      status: 'approved',
      source: 'institution_employer',
      addedBy: `employer:${approved.id}`,
      institutionScopeId: institutionId,
      expiresAt: new Date(now.getTime() + 45 * DAY),
    })),
  })
  // The employer asked to meet the featured alum, who shares their Dossier.
  if (dossierSharers.includes(featured)) {
    await db.dossierIntroRequest.create({
      data: { institutionId, employerProfileId: approved.id, memberId: mid(featured), requestedBy: 'demo-seed', note: 'We’re hiring a senior analyst and your background stood out.', isSampleData: true },
    })
  }

  // ── Resilience Fund ──────────────────────────────────────────────────────
  const fund = await db.resilienceFund.create({
    data: {
      institutionId,
      name: `${tenant.name} Resilience Fund`,
      description: 'Covers coaching and premium seats for alumni between jobs.',
      goalCents: 25_000_000,
      raisedCents: 8_400_000,
      isSampleData: true,
    },
  })
  await db.fundAward.createMany({
    data: [flagged[0], landed[0]]
      .filter((i) => i !== undefined)
      .map((i, k) => ({ fundId: fund.id, memberId: mid(i), awardType: 'COACHING_PACKAGE' as const, valueCents: 75_000, status: k === 0 ? ('AWARDED' as const) : ('REDEEMED' as const), awardedBy: 'demo-seed', awardedAt: new Date(now.getTime() - (k === 0 ? 5 : 120) * DAY), isSampleData: true })),
  })

  return {
    institutionId,
    members: memberRows.length,
    joined: joinedIdx.length,
    staff: staff.length,
    flags: flagged.length + (lookingMember ? 1 : 0),
    gifts: gifts.length,
    mentors: mentors.length,
    layoffMatches: notice ? atWarn.size : 0,
  }
}

// The demo's "advance time" control: run the nightly grace check as if
// `days` had passed, so the quiet period ends and the thank-you ask appears.
export async function advanceDemoTime(institutionId: string, days: number, now = new Date()) {
  return clearEndedGrace(new Date(now.getTime() + days * DAY), institutionId)
}
