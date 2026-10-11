// The only way staff code reads candidate data (spec §8). Each reader takes
// the WorkspaceContext requireWorkspace() returned, checks the role the spec
// assigns to that view, then reads the consent-applying view in
// prisma/sql/higher-ed-views.sql. Consent is applied in SQL, so a NULL
// coming back here means "not shared" and must render as such.

import 'server-only'
import { Prisma, type PrismaClient, type InstitutionAffiliation, type InstitutionMemberStatus, type TransitionFlagState } from '@prisma/client'
import { prisma } from '@/lib/prisma'
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
           "lastCoachingAt", "nextCheckInAt", "nextCheckInKind"
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
