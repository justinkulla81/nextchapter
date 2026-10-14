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
import { seedCommunity } from './demo-community'

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
  'Registered nurse moving into clinical informatics; led an Epic rollout on a 40-bed unit.',
  'Controller at a family-owned distributor; ready for a CFO seat at a growing company.',
  'High school chemistry teacher changing careers into instructional design.',
  'Supply chain planner who cut stockouts 30%; looking at logistics and manufacturing roles.',
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
        // On so the demo shows the Workforce board workspace.
        wioa: true,
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
  const recent = { dismissedAt: null, source: 'WARN_FILING' as const, state: { not: null }, noticeDate: { gte: new Date(now.getTime() - 150 * DAY), lte: now }, employees: { gte: 25 } }
  const notice =
    (state ? await db.warnNotice.findFirst({ where: { ...recent, state: state }, orderBy: { noticeDate: 'desc' }, select: { id: true, employer: true, companyId: true } }) : null) ??
    (await db.warnNotice.findFirst({ where: recent, orderBy: { noticeDate: 'desc' }, select: { id: true, employer: true, companyId: true } }))

  // ── Members ──────────────────────────────────────────────────────────────
  const n = tenant.memberCount ?? 200
  const isJoined = (i: number) => [1, 4, 8].includes(i % 10)
  const isParent = (i: number) => i % 20 === 7
  const dnc = (i: number) => i % 23 === 11
  // Alumni classes span the first n - 8 people; the last eight are students.
  const classOf = (i: number) => FIRST_CLASS + Math.min(LAST_CLASS - FIRST_CLASS, Math.round((i * (LAST_CLASS - FIRST_CLASS)) / (n - 9)))
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
  const rosterEmployers = tenant.employers.filter((e) => e !== employerCo)

  const idOf = (i: number) => (i === featured ? `${slug}_member_featured` : i === hero ? `${slug}_member_hero` : `${slug}_member_${String(i).padStart(3, '0')}`)
  const joinedIdx: number[] = []
  const memberRows: Prisma.InstitutionMemberCreateManyInput[] = []
  for (let i = 0; i < n; i++) {
    // Unique for up to 400 people: same first name → a different last name.
    const firstName = FIRST[i % FIRST.length]
    const lastName = LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length]
    // The last eight are current students (classes of next year onward).
    const student = i >= n - 8
    const classYear = student ? now.getUTCFullYear() + 1 + (i % 3) : classOf(i)
    const affiliation: InstitutionAffiliation = isParent(i) ? 'PARENT' : student ? 'STUDENT' : 'ALUM'
    const joined = isJoined(i) && !isParent(i) && !student
    if (joined) joinedIdx.push(i)
    const status: InstitutionMemberStatus = joined ? 'CLAIMED' : i % 5 === 0 ? 'INVITED' : 'IMPORTED'
    const employer = atWarn.has(i) && notice ? notice.employer : classYear >= now.getUTCFullYear() - 1 ? null : pick(rosterEmployers, i, 5)
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
      metroArea: i === featured ? 'Pittsburgh' : (['Pittsburgh', 'Pittsburgh', 'Philadelphia', 'Washington, DC', 'New York'] as const)[k % 5],
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
  const landed = [...laidOff.slice(8, 11), ...joinedIdx.filter((i) => journeyOf.get(i) === 'PROMOTION' && i % 6 !== 2).slice(0, 1), ...laidOff.slice(11, 13)].slice(0, 6)
  const vp = landed[3]
  for (const [k, i] of landed.entries()) {
    const placedAt = new Date(now.getTime() - [95, 80, 40, 75, 20, 10][k] * DAY)
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
    const newEmployer = pick(rosterEmployers, i, 9)
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

  // ── V2: programs, cohorts, enrollment, clients, capstones ────────────────
  const facultyUser = staff.find((x) => x.role === 'FACULTY') ?? staff.find((x) => x.role === 'EXEC_ED')
  const programDefs = [
    { name: 'AI-Ready Professional Certificate', summary: 'Six weeks of practical generative AI for working professionals: prompting, automating your own workflow, and judging output.', audience: 'Mid-career alumni and local employers', credential: 'AI-Ready Professional Certificate', priceCents: 149_500, wioaEligible: true, skills: ['AI', 'automation', 'prompting'], cipCode: '11.0102', hours: 36, credentialType: 'certificate', prerequisites: 'None' },
    { name: 'Data analytics certificate', summary: 'SQL, spreadsheets and dashboards, with a capstone on a local employer’s data.', audience: 'Alumni and adult learners', credential: 'Data Analytics Certificate', priceCents: 249_500, wioaEligible: true, skills: ['SQL', 'data analysis', 'dashboards', 'Excel'], cipCode: '11.0802', hours: 90, credentialType: 'certificate', prerequisites: null },
    { name: 'Leading teams through AI', summary: 'For managers and executives: choosing use cases, redesigning roles, governance.', audience: 'Senior alumni', credential: null, priceCents: 0, wioaEligible: false, skills: ['leadership', 'strategy'] },
  ]
  const programs = await Promise.all(
    programDefs.map((p) => db.program.create({ data: { ...p, institutionId, createdBy: 'demo-seed', isSampleData: true }, select: { id: true, name: true, credential: true } })),
  )
  const cohortDefs = [
    { p: 0, name: 'Spring 2026, online', start: -210, end: -168 },
    { p: 0, name: 'Fall 2026, online', start: -20, end: 22 },
    { p: 1, name: 'Summer 2026, hybrid', start: -150, end: -60 },
    { p: 1, name: 'Winter 2027, online', start: 40, end: 130 },
    { p: 2, name: 'Executive cohort, Jan 2027', start: 75, end: 90 },
  ]
  const cohorts = await Promise.all(
    cohortDefs.map((c) =>
      db.cohort.create({
        data: { programId: programs[c.p].id, name: c.name, startsAt: new Date(now.getTime() + c.start * DAY), endsAt: new Date(now.getTime() + c.end * DAY), seats: 25, modality: c.name.includes('hybrid') ? 'hybrid' : 'online', facultyUserId: facultyUser?.id ?? null, sessionsTotal: c.p === 2 ? null : 12, minAttendancePct: c.p === 2 ? null : 80, requiresCapstone: c.p === 1, isSampleData: true },
        select: { id: true },
      }),
    ),
  )
  const clientRows = await Promise.all(
    [
      { name: rosterEmployers[0], contactName: 'Talent development', seatsPurchased: 10, notes: 'AI-Ready for their operations managers; renews in June' },
      { name: rosterEmployers[2], contactName: 'HR', seatsPurchased: 4, notes: 'Data analytics for two teams' },
    ].map((c) => db.corporateClient.create({ data: { ...c, institutionId, isSampleData: true }, select: { id: true } })),
  )
  // Laid-off alumni on WIOA vouchers in the finished cohorts (two placed,
  // from the outcome reports above), employer-sponsored and self-pay seats,
  // and a few applications waiting.
  const enrollRows: Prisma.EnrollmentCreateManyInput[] = []
  const wioaPeople = [...landed.slice(0, 2), ...flagged.slice(1, 4)]
  wioaPeople.forEach((i, k) => {
    const done = k < 3
    const cohort = done ? (k === 2 ? cohorts[2] : cohorts[0]) : cohorts[1]
    const def = done ? (k === 2 ? cohortDefs[2] : cohortDefs[0]) : cohortDefs[1]
    const completedAt = done ? new Date(now.getTime() + def.end * DAY) : null
    enrollRows.push({ cohortId: cohort.id, memberId: mid(i), status: done ? 'COMPLETED' : 'ENROLLED', payer: k === 2 ? 'BOARD_CONTRACT' : 'WIOA_VOUCHER', appliedAt: new Date(now.getTime() + (def.start - 30) * DAY), enrolledAt: new Date(now.getTime() + def.start * DAY), completedAt, credentialName: done ? programs[cohortDefs.indexOf(def) === 2 ? 1 : 0].credential : null, isSampleData: true })
  })
  const others = joinedIdx.filter((i) => !wioaPeople.includes(i) && !flagged.includes(i)).slice(0, 14)
  others.forEach((i, k) => {
    const cohortIdx = [1, 1, 1, 0, 0, 2, 2, 3, 3, 3, 4, 4, 1, 3][k]
    const def = cohortDefs[cohortIdx]
    const started = def.start < 0
    const finished = def.end < 0
    const status = k >= 11 ? 'APPLIED' : finished ? 'COMPLETED' : started ? 'ENROLLED' : 'APPLIED'
    const sponsored = k % 3 === 0
    enrollRows.push({
      cohortId: cohorts[cohortIdx].id,
      memberId: mid(i),
      status,
      payer: sponsored ? 'EMPLOYER' : k % 5 === 1 ? 'RESILIENCE_FUND' : 'SELF_PAY',
      corporateClientId: sponsored ? clientRows[k % 2].id : null,
      note: status === 'APPLIED' && k % 2 ? 'Needs help paying.' : null,
      appliedAt: new Date(now.getTime() + Math.min(def.start - 20, -3) * DAY),
      enrolledAt: status === 'APPLIED' ? null : new Date(now.getTime() + def.start * DAY),
      completedAt: status === 'COMPLETED' ? new Date(now.getTime() + def.end * DAY) : null,
      credentialName: status === 'COMPLETED' ? programs[def.p].credential : null,
      isSampleData: true,
    })
  })
  await db.enrollment.createMany({ data: enrollRows, skipDuplicates: true })
  // The landed WIOA completers' new-job reports come after they finished, so
  // the board sees them placed.
  for (const i of landed.slice(0, 2)) {
    await db.outcomeReport.updateMany({ where: { memberId: mid(i) }, data: { reportedAt: new Date(now.getTime() - 150 * DAY) } })
  }
  await db.capstone.createMany({
    data: [
      { institutionId, institutionEmployerId: (await db.institutionEmployer.findFirstOrThrow({ where: { institutionId, employerProfileId: approved.id }, select: { id: true } })).id, employerName: employerCo, title: 'Predict which customers will churn next quarter', brief: 'Two years of anonymized account data. We would like a model, the three signals that matter most, and a one-page playbook for our account managers.', term: 'Spring 2027', programId: programs[1].id, status: 'PROPOSED', interviewCommitments: 3, proposedBy: 'demo-seed', isSampleData: true },
      { institutionId, employerName: rosterEmployers[0], title: 'Cut patient no-shows at three clinics', brief: 'Appointment history and reminder logs. Find what predicts a no-show and test a better reminder schedule.', term: 'Fall 2026', programId: programs[1].id, status: 'IN_PROGRESS', facultyUserId: facultyUser?.id ?? null, interviewCommitments: 2, proposedBy: 'demo-seed', decidedAt: new Date(now.getTime() - 40 * DAY), isSampleData: true },
      { institutionId, employerName: rosterEmployers[3], title: 'An AI policy for a 400-person manufacturer', brief: 'Draft the acceptable-use policy and a rollout plan for supervisors.', term: 'Spring 2026', programId: programs[0].id, status: 'COMPLETED', facultyUserId: facultyUser?.id ?? null, interviewCommitments: 1, proposedBy: 'demo-seed', decidedAt: new Date(now.getTime() - 220 * DAY), isSampleData: true },
    ],
  })

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

  // ── Lifecycle: credentials, attendance, office hours, events, intros,
  // segments, learners, rapid response, a Market Reality gap for the
  // featured alum (so a program is recommended) ──────────────────────────
  for (const e of await db.enrollment.findMany({ where: { cohort: { program: { institutionId } } }, select: { id: true, status: true } })) {
    await db.enrollment.update({
      where: { id: e.id },
      data: e.status === 'COMPLETED' ? { credentialId: createHash('sha256').update(`${slug}-${e.id}`).digest('hex').slice(0, 32), sessionsAttended: 11, capstoneDone: true } : e.status === 'ENROLLED' ? { sessionsAttended: 4 } : {},
    })
  }
  const slotRows: Prisma.OfficeHourSlotCreateManyInput[] = []
  mentors.slice(0, 6).forEach((m, k) => {
    for (let n = 0; n < 3; n++) {
      const d = new Date(now.getTime() + (2 + k + n * 3) * DAY)
      d.setUTCHours(16 + (k % 3), 0, 0, 0)
      slotRows.push({ institutionId, mentorId: m.id, startsAt: d, minutes: 20, topic: ['Résumé reads', 'Mock interviews', 'Breaking into the field'][k % 3], isSampleData: true, ...(n === 0 && k < 2 ? { bookedByMemberId: mid(k === 0 ? featured : flagged[0]), bookedAt: now, bookingNote: 'Would love a résumé read before I apply.' } : {}) })
    }
  })
  await db.officeHourSlot.createMany({ data: slotRows })
  const eventDefs = [
    { title: 'Careers in healthcare: a panel of alumni', kind: 'panel', days: 9, location: 'Online' },
    { title: `Employer night with ${employerCo}`, kind: 'employer_night', days: 16, location: 'Campus center' },
    { title: 'Negotiating your offer: a workshop', kind: 'workshop', days: 23, location: 'Online' },
    { title: 'Pittsburgh alumni networking breakfast', kind: 'networking', days: -12, location: 'Downtown Pittsburgh' },
  ]
  const collegeEvents = await Promise.all(
    eventDefs.map((e) =>
      db.collegeEvent.create({ data: { institutionId, title: e.title, kind: e.kind, startsAt: new Date(Math.floor((now.getTime() + e.days * DAY) / DAY) * DAY + 22 * 3600_000), location: e.location, capacity: e.kind === 'networking' ? 40 : null, createdBy: 'demo-seed', isSampleData: true }, select: { id: true } }),
    ),
  )
  await db.eventRsvp.createMany({
    data: collegeEvents.flatMap((e, k) =>
      joinedIdx.slice(k * 5, k * 5 + 8 + k * 3).map((i) => ({ eventId: e.id, memberId: mid(i), checkedInAt: eventDefs[k].days < 0 ? new Date(now.getTime() + eventDefs[k].days * DAY) : null, isSampleData: true })),
    ),
    skipDuplicates: true,
  })
  await db.eventRsvp.createMany({ data: [{ eventId: collegeEvents[1].id, memberId: mid(featured), isSampleData: true }], skipDuplicates: true })
  // Intros: the featured alum asked two alumni at the employer; one accepted.
  // Someone asked the featured alum about their own employer.
  const atEmployer = [leader, ...joinedIdx.slice(2, 4)].filter((i) => i !== featured && i % 6 !== 2)
  const introRows: Prisma.AlumniIntroRequestCreateManyInput[] = atEmployer.slice(0, 2).map((i, k) => ({
    institutionId,
    requesterMemberId: mid(featured),
    targetMemberId: mid(i),
    companyName: employerCo,
    purpose: 'interviewing',
    note: 'I have a second-round interview for the senior analyst role next week.',
    status: k === 0 ? 'ACCEPTED' : 'REQUESTED',
    respondedAt: k === 0 ? new Date(now.getTime() - 2 * DAY) : null,
    isSampleData: true,
  }))
  const featuredEmployer = (await db.institutionMember.findUniqueOrThrow({ where: { id: mid(featured) }, select: { lastKnownEmployer: true } })).lastKnownEmployer
  if (featuredEmployer) introRows.push({ institutionId, requesterMemberId: mid(flagged[1]), targetMemberId: mid(featured), companyName: featuredEmployer, purpose: 'applying', note: 'I’m applying to an operations role there. What’s the team like?', isSampleData: true })
  await db.alumniIntroRequest.createMany({ data: introRows, skipDuplicates: true })
  await db.segment.createMany({
    data: [
      { institutionId, name: 'In transition, class of 1995–2015', filters: { classFrom: 1995, classTo: 2015, inTransition: true }, createdBy: 'demo-seed', isSampleData: true },
      { institutionId, name: 'Joined alumni in Pittsburgh', filters: { joined: 'joined', metro: 'Pittsburgh' }, createdBy: 'demo-seed', isSampleData: true },
    ],
  })
  // Two of a corporate client's employees, not alumni, in the AI cohort.
  for (const [k, n] of ['Morgan Reyes', 'Taylor Brandt'].entries()) {
    const [first, last] = n.split(' ')
    const learner = await db.institutionMember.create({ data: { institutionId, email: `${first}.${last}@${slug}-client.example.com`.toLowerCase(), firstName: first, lastName: last, affiliation: 'LEARNER', matchMethod: 'MANUAL', isSampleData: true }, select: { id: true } })
    await db.enrollment.create({ data: { cohortId: cohorts[1].id, memberId: learner.id, status: 'ENROLLED', enrolledAt: new Date(now.getTime() - 20 * DAY), payer: 'EMPLOYER', corporateClientId: clientRows[0].id, sessionsAttended: 3 + k, isSampleData: true } })
  }
  // Rapid response for the real WARN filing the hero is matched to.
  if (notice) {
    const rr = await db.rapidResponse.create({
      data: { institutionId, warnNoticeId: notice.id, employerName: notice.employer, title: `Free retraining for ${notice.employer} employees`, message: `If you're affected by the layoff at ${notice.employer}, ${tenant.name} and the local workforce board can cover a short program to help you land your next role. WIOA funding may pay the full cost.`, programIds: [programs[0].id, programs[1].id], createdBy: 'demo-seed', isSampleData: true },
      select: { id: true },
    })
    const worker = await db.institutionMember.create({ data: { institutionId, email: `jamie.ortiz@${slug}-community.example.com`, firstName: 'Jamie', lastName: 'Ortiz', affiliation: 'LEARNER', matchMethod: 'MANUAL', lastKnownEmployer: notice.employer, isSampleData: true }, select: { id: true } })
    await db.enrollment.createMany({
      data: [
        { cohortId: cohorts[3].id, memberId: worker.id, payer: 'WIOA_VOUCHER', rapidResponseId: rr.id, note: `Rapid response: ${notice.employer}.`, isSampleData: true },
        { cohortId: cohorts[3].id, memberId: mid(hero), payer: 'WIOA_VOUCHER', rapidResponseId: rr.id, note: `Rapid response: ${notice.employer}. Interested in the evening section.`, isSampleData: true },
      ],
      skipDuplicates: true,
    })
  }
  await db.marketRealityReport.create({
    data: {
      candidateId: candidateOf(featured),
      strengths: [{ title: 'Operations depth', detail: 'Ten years running teams.' }],
      weaknesses: [{ title: 'Data skills', detail: 'Analyst roles expect SQL.' }],
      actionPlan: Array.from({ length: 7 }, (_, d) => ({ day: d + 1, items: [] })),
      gapAnalysis: { targetRole: 'Senior Data Analyst', gaps: [{ area: 'SQL and data analysis', why: 'Most target postings ask for it.', remediation: 'A short certificate with a portfolio project.', remediationType: 'course' }] },
      generatedAt: new Date(now.getTime() - 5 * DAY),
    },
  })

  await seedCommunity(db, {
    institutionId,
    tenant,
    now,
    joined: joinedIdx.map(mid),
    featured: mid(featured),
    student: memberRows.some((r) => r.affiliation === 'STUDENT') ? memberRows.filter((r) => r.affiliation === 'STUDENT')[0].id! : null,
    facultyUserId: facultyUser?.id ?? null,
    employers: rosterEmployers,
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
