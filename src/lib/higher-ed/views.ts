// The only way staff code reads candidate data (spec §8). Each reader takes
// the WorkspaceContext requireWorkspace() returned, checks the role the spec
// assigns to that view, then reads the consent-applying view in
// prisma/sql/higher-ed-views.sql. Consent is applied in SQL, so a NULL
// coming back here means "not shared" and must render as such.

import 'server-only'
import { Prisma, type PrismaClient, type InstitutionAffiliation, type InstitutionMemberStatus, type TransitionFlagState } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CurrentJobStatus } from '@prisma/client'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { effectiveJourney, JOURNEYS, type JourneyStage, type JourneyType } from '@/lib/journey/journey'
import { holds, WorkspaceAccessError, type InstitutionAccess } from './resolve'
import type { AccessToken } from './workspaces'
import { logMemberView } from './audit'

type Db = PrismaClient | Prisma.TransactionClient
type Ctx = Pick<InstitutionAccess, 'tokens' | 'institution' | 'staffUsers' | 'mode' | 'email' | 'userId'> & { workspace?: string }

const ANY_STAFF: AccessToken[] = [
  'INSTITUTION_ADMIN',
  'ALUMNI_RELATIONS',
  'DEVELOPMENT',
  'CAREER_SERVICES',
  'EMPLOYER_RELATIONS',
  'COACH',
  'FACULTY',
  'EXEC_ED',
  'VIEWER:alumni',
  'VIEWER:development',
  'VIEWER:career',
  'VIEWER:coaching',
  'VIEWER:teaching',
  'VIEWER:execed',
]
const TRANSITION_ROLES: AccessToken[] = [
  'INSTITUTION_ADMIN',
  'ALUMNI_RELATIONS',
  'DEVELOPMENT',
  'CAREER_SERVICES',
  'VIEWER:alumni',
  'VIEWER:development',
  'VIEWER:career',
]
const ROI_ROLES: AccessToken[] = ['INSTITUTION_ADMIN', 'DEVELOPMENT', 'VIEWER:development']
// Aggregate re-employment outcomes by unemployment-duration bucket (never member rows).
const OUTCOMES_ROLES: AccessToken[] = ['INSTITUTION_ADMIN', 'CAREER_SERVICES', 'DEVELOPMENT', 'VIEWER:career', 'VIEWER:development']
// Sees every open caseload (the Career Services director).
const CASELOAD_ALL_ROLES: AccessToken[] = ['INSTITUTION_ADMIN', 'VIEWER:career']

function assertHolds(ctx: Ctx, roles: AccessToken[], what: string) {
  if (!holds(ctx, roles)) throw new WorkspaceAccessError(`No access to ${what} at ${ctx.institution.slug}`)
}

export type DirectoryRow = {
  memberId: string
  firstName: string | null
  lastName: string | null
  classYear: number | null
  affiliation: InstitutionAffiliation
  status: InstitutionMemberStatus
  doNotContact: boolean
  shareOutcome: boolean
  shareEngagement: boolean
  employer: string | null // null when not shared (see shareOutcome) or unknown
  title: string | null
  engagementPoints12mo: number | null // null when engagement isn't shared
}

export async function listMemberDirectory(
  ctx: Ctx,
  opts: { page?: number; pageSize?: number; q?: string; classYear?: number; status?: InstitutionMemberStatus } = {},
  db: Db = prisma,
): Promise<{ rows: DirectoryRow[]; total: number; page: number; pageSize: number }> {
  assertHolds(ctx, ANY_STAFF, 'the member directory')
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100)
  const page = Math.max(opts.page ?? 1, 1)
  const where: Prisma.Sql[] = [Prisma.sql`"institutionId" = ${ctx.institution.id}`]
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`
    where.push(Prisma.sql`("firstName" ilike ${like} or "lastName" ilike ${like} or ("firstName" || ' ' || "lastName") ilike ${like})`)
  }
  if (opts.classYear) where.push(Prisma.sql`"classYear" = ${opts.classYear}`)
  if (opts.status) where.push(Prisma.sql`status = ${opts.status}::"InstitutionMemberStatus"`)
  const filter = Prisma.join(where, ' and ')

  const [rows, count] = await Promise.all([
    db.$queryRaw<DirectoryRow[]>`
      select "memberId", "firstName", "lastName", "classYear", affiliation, status, "doNotContact",
             "shareOutcome", "shareEngagement", employer, title, "engagementPoints12mo"
      from private.v_member_directory
      where ${filter}
      order by "lastName" nulls last, "firstName" nulls last, "memberId"
      limit ${pageSize} offset ${(page - 1) * pageSize}`,
    db.$queryRaw<{ n: number }[]>`select count(*)::int as n from private.v_member_directory where ${filter}`,
  ])
  return { rows, total: count[0]?.n ?? 0, page, pageSize }
}

// One member, for a staff detail view. Writes the AdminAccessLog row that
// "Who viewed my profile" reads (spec §8 audit).
export async function getMemberForStaff(ctx: Ctx & { workspace: string }, memberId: string, db: Db = prisma): Promise<DirectoryRow | null> {
  assertHolds(ctx, ANY_STAFF, 'member records')
  const rows = await db.$queryRaw<DirectoryRow[]>`
    select "memberId", "firstName", "lastName", "classYear", affiliation, status, "doNotContact",
           "shareOutcome", "shareEngagement", employer, title, "engagementPoints12mo"
    from private.v_member_directory
    where "institutionId" = ${ctx.institution.id} and "memberId" = ${memberId}`
  if (!rows[0]) return null
  await logMemberView(ctx, memberId, db)
  return rows[0]
}

export type TransitionRow = {
  flagId: string
  memberId: string
  firstName: string | null
  lastName: string | null
  classYear: number | null
  state: TransitionFlagState
  doNotSolicit: boolean
  since: Date
  graceEndsAt: Date | null
}

// Open flags only. The view has no reason or source column, so Development
// can't see them through any path.
export async function listOpenTransitions(ctx: Ctx, db: Db = prisma): Promise<TransitionRow[]> {
  assertHolds(ctx, TRANSITION_ROLES, 'transition flags')
  return db.$queryRaw<TransitionRow[]>`
    select "flagId", "memberId", "firstName", "lastName", "classYear", state, "doNotSolicit", since, "graceEndsAt"
    from private.v_member_transition
    where "institutionId" = ${ctx.institution.id}
    order by since desc`
}

export type CaseloadRow = {
  assignmentId: string
  counselorId: string
  memberId: string
  firstName: string | null
  lastName: string | null
  classYear: number | null
  affiliation: InstitutionAffiliation
  shareSearchDetail: boolean
  // All four are null unless the member shares search detail with Career Services.
  lastActivityAt: Date | null
  sprintWeekStart: Date | null
  sprintActionsTotal: number | null
  sprintActionsDone: number | null
  lastCoachingAt: Date | null
  // Also only when shared: why they're moving and how close to applying.
  journey: string | null
  journeyStage: string | null
  nextCheckInAt: Date | null
  nextCheckInKind: string | null
}

// Counselors see only their own caseload; INSTITUTION_ADMIN (the director)
// sees all. On a demo tenant, the "Career Services" persona sees the seeded
// counselor's caseload, since the nc_admin isn't a counselor themselves.
export async function listCaseloadActivity(ctx: Ctx, db: Db = prisma): Promise<CaseloadRow[]> {
  assertHolds(ctx, ['CAREER_SERVICES', ...CASELOAD_ALL_ROLES], 'caseloads')
  let counselorFilter = Prisma.sql``
  if (!holds(ctx, CASELOAD_ALL_ROLES)) {
    let counselorIds = ctx.staffUsers.filter((s) => s.role === 'CAREER_SERVICES').map((s) => s.id)
    if (ctx.mode === 'demo-admin') {
      const seeded = await db.institutionUser.findMany({
        where: { institutionId: ctx.institution.id, role: 'CAREER_SERVICES', revokedAt: null },
        select: { id: true },
      })
      counselorIds = seeded.map((s) => s.id)
    }
    if (!counselorIds.length) return []
    counselorFilter = Prisma.sql`and "counselorId" in (${Prisma.join(counselorIds)})`
  }
  return db.$queryRaw<CaseloadRow[]>`
    select "assignmentId", "counselorId", "memberId", "firstName", "lastName", "classYear", affiliation,
           "shareSearchDetail", "lastActivityAt", "sprintWeekStart", "sprintActionsTotal", "sprintActionsDone",
           "lastCoachingAt", journey, "journeyStage", "nextCheckInAt", "nextCheckInKind"
    from private.v_caseload_activity
    where "institutionId" = ${ctx.institution.id} ${counselorFilter}
    order by "lastName" nulls last, "firstName" nulls last`
}

export type DossierRow = {
  memberId: string
  firstName: string | null
  lastName: string | null
  classYear: number | null
  degree: string | null
  major: string | null
  dossierSummary: string | null
}

// Approved employer seats only; the view already excludes everyone who
// hasn't turned Dossier sharing on.
export async function listEmployerDossiers(ctx: Ctx, db: Db = prisma): Promise<DossierRow[]> {
  assertHolds(ctx, ['EMPLOYER'], 'shared Dossiers')
  return db.$queryRaw<DossierRow[]>`
    select "memberId", "firstName", "lastName", "classYear", degree, major, "dossierSummary"
    from private.v_employer_dossiers
    where "institutionId" = ${ctx.institution.id}
    order by "lastName" nulls last, "firstName" nulls last`
}

export type RoiInputs = {
  memberCount: number
  claimedCount: number
  activeSeatCount: number
  openFlagCount: number
  giftCount: number
  giftCents: bigint
  lastGiftImportAt: Date | null
}

export async function getRoiInputs(ctx: Ctx, db: Db = prisma): Promise<RoiInputs | null> {
  assertHolds(ctx, ROI_ROLES, 'ROI inputs')
  const rows = await db.$queryRaw<RoiInputs[]>`
    select "memberCount", "claimedCount", "activeSeatCount", "openFlagCount", "giftCount", "giftCents", "lastGiftImportAt"
    from private.v_roi_inputs
    where "institutionId" = ${ctx.institution.id}`
  return rows[0] ?? null
}

export type OutcomesByBucketRow = {
  bucket: string
  members: number
  personWeeks: number
  reemployed: number
  hiresAll: number
  interimHires: number
  warmSourced: number
  withPay: number
  tookCut: number
  medianPayRetention: number | null
}

// Career Services "Outcomes" tab (outcomes release). Aggregates only; consent
// (SHARE_OUTCOME) is applied in the SQL view. The caller must still suppress
// small cells (src/lib/outcomes/institution-outcomes.ts does).
export async function getOutcomesByBucket(ctx: Ctx, db: Db = prisma): Promise<OutcomesByBucketRow[]> {
  assertHolds(ctx, OUTCOMES_ROLES, 'outcomes')
  return db.$queryRaw<OutcomesByBucketRow[]>`
    select bucket, members, "personWeeks", reemployed, "hiresAll", "interimHires", "warmSourced", "withPay", "tookCut", "medianPayRetention"
    from private.v_outcomes_by_bucket
    where "institutionId" = ${ctx.institution.id}`
}

export type MentorStats = {
  activeMentors: number
  requestsThisMonth: number
  acceptedThisMonth: number
  completedThisMonth: number
  completedAllTime: number
  topIndustries: { tag: string; mentors: number }[]
  topFunctions: { tag: string; mentors: number }[]
}

const MENTOR_STAFF_ROLES: AccessToken[] = ['INSTITUTION_ADMIN', 'ALUMNI_RELATIONS', 'VIEWER:alumni']
const MIN_TAG_MENTORS = 3 // a tag with fewer mentors could point at one person

// Alumni Relations "Mentors" tab. Counts only: no mentor or requester names, no
// request notes. Tags shown only when at least three mentors share them.
export async function getMentorStats(ctx: Ctx, db: Db = prisma): Promise<MentorStats> {
  assertHolds(ctx, MENTOR_STAFF_ROLES, 'mentor stats')
  const institutionId = ctx.institution.id
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const [mentors, requests, completedAllTime] = await Promise.all([
    db.institutionMentor.findMany({ where: { institutionId, isActive: true }, select: { industries: true, functions: true } }),
    db.mentorRequest.findMany({ where: { mentor: { institutionId }, requestedAt: { gte: monthStart } }, select: { status: true } }),
    db.mentorRequest.count({ where: { mentor: { institutionId }, status: 'COMPLETED' } }),
  ])
  const tally = (key: 'industries' | 'functions') => {
    const m = new Map<string, { tag: string; mentors: number }>()
    for (const x of mentors) {
      for (const t of new Set(x[key].map((v) => v.toLowerCase()))) {
        const original = x[key].find((v) => v.toLowerCase() === t) ?? t
        const e = m.get(t) ?? { tag: original, mentors: 0 }
        e.mentors += 1
        m.set(t, e)
      }
    }
    return [...m.values()].filter((e) => e.mentors >= MIN_TAG_MENTORS).sort((a, b) => b.mentors - a.mentors).slice(0, 6)
  }
  return {
    activeMentors: mentors.length,
    requestsThisMonth: requests.length,
    acceptedThisMonth: requests.filter((r) => r.status === 'ACCEPTED' || r.status === 'COMPLETED').length,
    completedThisMonth: requests.filter((r) => r.status === 'COMPLETED').length,
    completedAllTime,
    topIndustries: tally('industries'),
    topFunctions: tally('functions'),
  }
}

export type AlumniHomeCounts = { members: number; claimed: number; activeSeats: number; inTransition: number }

// Alumni Relations home (spec §5.2). Roster counts are the college's own
// data; the in-transition count comes from the transition view.
export async function getAlumniHomeCounts(ctx: Ctx, db: Db = prisma): Promise<AlumniHomeCounts> {
  assertHolds(ctx, TRANSITION_ROLES, 'Alumni Relations counts')
  const institutionId = ctx.institution.id
  const [members, claimed, activeSeats, inTransition] = await Promise.all([
    db.institutionMember.count({ where: { institutionId } }),
    db.institutionMember.count({ where: { institutionId, status: { in: ['CLAIMED', 'ACTIVE'] } } }),
    db.institutionMember.count({ where: { institutionId, isActiveSeat: true } }),
    db.$queryRaw<{ n: number }[]>`select count(*)::int as n from private.v_member_transition where "institutionId" = ${institutionId}`,
  ])
  return { members, claimed, activeSeats, inTransition: inTransition[0]?.n ?? 0 }
}

export type JourneyMix = { journey: JourneyType; count: number | null }[] // null = under the minimum group size

// Alumni Relations home: where joined alumni are, by journey, as counts only.
// Members who turned engagement sharing off aren't counted, and any group
// smaller than MIN_CELL_SIZE shows as "fewer than" rather than a number.
export async function getJourneyMix(ctx: Ctx, db: Db = prisma): Promise<{ mix: JourneyMix; total: number }> {
  assertHolds(ctx, TRANSITION_ROLES, 'the journey mix')
  const rows = await db.$queryRaw<{ journey: JourneyType | null; journeyStage: JourneyStage | null; currentJobStatus: CurrentJobStatus | null }[]>`
    select cp.journey, cp."journeyStage", cp."currentJobStatus"
    from public."InstitutionMember" m
    join private.v_member_consent mc on mc."memberId" = m.id and mc."shareEngagement"
    join public."CandidateProfile" cp on cp.id = m."candidateId"
    where m."institutionId" = ${ctx.institution.id} and m.status in ('CLAIMED', 'ACTIVE')`
  const counts = new Map<JourneyType, number>()
  for (const r of rows) {
    const j = effectiveJourney(r)
    if (j) counts.set(j, (counts.get(j) ?? 0) + 1)
  }
  const mix = JOURNEYS.map((j) => {
    const n = counts.get(j.key) ?? 0
    return { journey: j.key, count: n >= MIN_CELL_SIZE ? n : n === 0 ? 0 : null }
  })
  return { mix, total: rows.length }
}
