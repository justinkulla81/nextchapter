import 'server-only'
import { randomUUID } from 'crypto'
import type { OutplacementProgramType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EMPLOYER_MIN_CELL_SIZE } from '@/lib/employer/candidate-identity-guard'
import { createAdminClient } from '@/lib/supabase/admin'

// Growth and Learning: programs for an employer's current people (src/lib/employer/program-type.ts).
// The employer sees counts only, each held back until at least
// EMPLOYER_MIN_CELL_SIZE people have joined, the same rule as outplacement
// reporting. The one place a person's name reaches the employer is
// InternalRoleInterest: the person pressing "Tell {org} I'm interested" on a
// role, with that spelled out on the button. Promotions and raises count only
// people who chose to share outcomes (OutplacementSeat.shareOutcomeWithEmployer).

const DAY = 24 * 60 * 60 * 1000

// Internal roles are ExclusiveJobPosting rows with their own status, so no
// open-board, market or company query (every one of them asks for
// status 'approved') ever counts them.
export const INTERNAL_ROLE_STATUS = 'internal'
export const INTERNAL_ROLE_SOURCE = 'org_internal'

// Which programs an org has an active contract for.
export async function orgProgramTypes(orgId: string): Promise<Set<OutplacementProgramType>> {
  const rows = await prisma.outplacementContract.findMany({ where: { orgId, status: 'ACTIVE' }, select: { programType: true }, distinct: ['programType'] })
  return new Set(rows.map((r) => r.programType))
}

type SeatRow = { candidateId: string | null; status: string; cohort: string | null; shareOutcomeWithEmployer: boolean }

async function programSeats(orgId: string, programType: OutplacementProgramType): Promise<SeatRow[]> {
  return prisma.outplacementSeat.findMany({
    where: { contract: { orgId, programType, status: 'ACTIVE' }, status: { not: 'DEACTIVATED' } },
    select: { candidateId: true, status: true, cohort: true, shareOutcomeWithEmployer: true },
  })
}

const joinedIds = (seats: SeatRow[]) => [...new Set(seats.filter((s) => s.status === 'ACTIVATED' && s.candidateId).map((s) => s.candidateId as string))]

// A count, or null while too few people have joined to show one safely.
export type Cell = number | null
const cell = (n: number, population: number): Cell => (population >= EMPLOYER_MIN_CELL_SIZE ? n : null)

async function activeIn30Days(ids: string[]): Promise<number> {
  if (!ids.length) return 0
  const rows = await prisma.dailyCheckIn.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids }, checkedInAt: { gte: new Date(Date.now() - 30 * DAY) } } })
  return rows.length
}

const distinctCount = (rows: { candidateId: string }[]) => new Set(rows.map((r) => r.candidateId)).size

// Teams (the seat's cohort) with enough people to show on their own; the
// rest are pooled into "Other teams" when that pool clears the bar.
function teams(seats: SeatRow[]): { label: string; ids: string[] }[] {
  const by = new Map<string, string[]>()
  for (const s of seats) {
    if (s.status !== 'ACTIVATED' || !s.candidateId) continue
    const k = s.cohort?.trim() || ''
    by.set(k, [...(by.get(k) ?? []), s.candidateId])
  }
  const out: { label: string; ids: string[] }[] = []
  const rest: string[] = []
  for (const [label, ids] of by) {
    if (label && ids.length >= EMPLOYER_MIN_CELL_SIZE) out.push({ label, ids })
    else rest.push(...ids)
  }
  out.sort((a, b) => b.ids.length - a.ids.length)
  if (out.length && rest.length >= EMPLOYER_MIN_CELL_SIZE) out.push({ label: 'Other teams', ids: rest })
  return out
}

export type GrowthCounts = {
  joined: number
  active30: Cell
  usingTools: Cell
  promotionPlans: Cell
  reviewPrepDone: Cell
  interestedInInternal: Cell
}

async function orgRoleIds(orgId: string): Promise<string[]> {
  return (await prisma.exclusiveJobPosting.findMany({ where: { orgScopeId: orgId, status: INTERNAL_ROLE_STATUS }, select: { id: true } })).map((r) => r.id)
}

async function growthCounts(ids: string[], roleIds: string[]): Promise<GrowthCounts> {
  const population = ids.length
  if (!population) return { joined: 0, active30: null, usingTools: null, promotionPlans: null, reviewPrepDone: null, interestedInInternal: null }
  const yearAgo = new Date(Date.now() - 365 * DAY)
  const where = { candidateId: { in: ids } }
  const [active30, profiles, wins, preps, plans, prepDone, interest] = await Promise.all([
    activeIn30Days(ids),
    prisma.inWorkProfile.findMany({ where, select: { candidateId: true } }),
    prisma.inWorkWin.findMany({ where, select: { candidateId: true }, distinct: ['candidateId'] }),
    prisma.inWorkPrep.findMany({ where, select: { candidateId: true }, distinct: ['candidateId'] }),
    prisma.inWorkPromotionPlan.count({ where }),
    prisma.inWorkPrep.findMany({ where: { ...where, completedAt: { gte: yearAgo } }, select: { candidateId: true }, distinct: ['candidateId'] }),
    roleIds.length ? prisma.internalRoleInterest.findMany({ where: { ...where, postingId: { in: roleIds } }, select: { candidateId: true }, distinct: ['candidateId'] }) : [],
  ])
  return {
    joined: population,
    active30: cell(active30, population),
    usingTools: cell(distinctCount([...profiles, ...wins, ...preps]), population),
    promotionPlans: cell(plans, population),
    reviewPrepDone: cell(prepDone.length, population),
    interestedInInternal: cell(interest.length, population),
  }
}

export type GrowthReport = {
  enrolled: number
  overall: GrowthCounts
  byTeam: ({ label: string } & GrowthCounts)[]
  // Among people who chose to share outcomes, last 12 months.
  outcomes: { sharing: number; promoted: Cell; raised: Cell }
  openRoles: number
}

export async function growthReport(orgId: string): Promise<GrowthReport> {
  const seats = await programSeats(orgId, 'GROWTH')
  const ids = joinedIds(seats)
  const sharingIds = [...new Set(seats.filter((s) => s.status === 'ACTIVATED' && s.candidateId && s.shareOutcomeWithEmployer).map((s) => s.candidateId as string))]
  const yearAgo = new Date(Date.now() - 365 * DAY)
  const roleIds = await orgRoleIds(orgId)
  const [overall, byTeam, promoted, raised, openRoles] = await Promise.all([
    growthCounts(ids, roleIds),
    Promise.all(teams(seats).map(async (t) => ({ label: t.label, ...(await growthCounts(t.ids, roleIds)) }))),
    sharingIds.length ? prisma.inWorkOutcome.findMany({ where: { candidateId: { in: sharingIds }, promoted: true, reviewedOn: { gte: yearAgo } }, select: { candidateId: true }, distinct: ['candidateId'] }) : [],
    sharingIds.length ? prisma.inWorkOutcome.findMany({ where: { candidateId: { in: sharingIds }, raiseReceived: true, reviewedOn: { gte: yearAgo } }, select: { candidateId: true }, distinct: ['candidateId'] }) : [],
    prisma.exclusiveJobPosting.count({ where: { orgScopeId: orgId, status: INTERNAL_ROLE_STATUS, archivedAt: null } }),
  ])
  return {
    enrolled: seats.length,
    overall,
    byTeam,
    outcomes: { sharing: sharingIds.length, promoted: cell(promoted.length, sharingIds.length), raised: cell(raised.length, sharingIds.length) },
    openRoles,
  }
}

export type LearningReport = {
  enrolled: number
  joined: number
  active30: Cell
  started: Cell
  completed: Cell
  courses: { id: string; title: string; provider: string | null; covered: string | null; isActive: boolean; started: Cell; completed: Cell }[]
  byTeam: { label: string; joined: number; started: Cell; completed: Cell }[]
}

export async function learningReport(orgId: string): Promise<LearningReport> {
  const seats = await programSeats(orgId, 'LEARNING')
  const ids = joinedIds(seats)
  const population = ids.length
  const [active30, courses, progress] = await Promise.all([
    activeIn30Days(ids),
    prisma.orgCourse.findMany({ where: { orgId }, orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }], select: { id: true, title: true, provider: true, covered: true, isActive: true } }),
    ids.length ? prisma.orgCourseProgress.findMany({ where: { candidateId: { in: ids }, course: { orgId } }, select: { candidateId: true, courseId: true, status: true } }) : [],
  ])
  const startedBy = (subset: Set<string>) => new Set(progress.filter((p) => subset.has(p.candidateId)).map((p) => p.candidateId)).size
  const completedBy = (subset: Set<string>) => new Set(progress.filter((p) => subset.has(p.candidateId) && p.status === 'COMPLETED').map((p) => p.candidateId)).size
  const all = new Set(ids)
  return {
    enrolled: seats.length,
    joined: population,
    active30: cell(active30, population),
    started: cell(startedBy(all), population),
    completed: cell(completedBy(all), population),
    courses: courses.map((c) => ({
      ...c,
      started: cell(progress.filter((p) => p.courseId === c.id).length, population),
      completed: cell(progress.filter((p) => p.courseId === c.id && p.status === 'COMPLETED').length, population),
    })),
    byTeam: teams(seats).map((t) => {
      const s = new Set(t.ids)
      return { label: t.label, joined: t.ids.length, started: cell(startedBy(s), t.ids.length), completed: cell(completedBy(s), t.ids.length) }
    }),
  }
}

// ---- Internal roles (Growth) ----------------------------------------------

export type InternalRoleInput = { title: string; location: string | null; description: string | null; applyUrl: string | null }

export function readInternalRole(f: FormData): InternalRoleInput | { error: string } {
  const title = String(f.get('title') ?? '').trim().slice(0, 140)
  if (!title) return { error: 'Give the role a title.' }
  const applyRaw = String(f.get('applyUrl') ?? '').trim()
  let applyUrl: string | null = null
  if (applyRaw) {
    try {
      const u = new URL(applyRaw)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol')
      applyUrl = u.toString()
    } catch {
      return { error: 'The apply link needs to be a full web address, starting with https://.' }
    }
  }
  return {
    title,
    location: String(f.get('location') ?? '').trim().slice(0, 120) || null,
    description: String(f.get('description') ?? '').trim().slice(0, 4000) || null,
    applyUrl,
  }
}

// ExclusiveJobPosting.url is unique across every job, so an internal role's
// row keeps its own key; the apply link (if any) rides in front of it.
const internalUrl = (applyUrl: string | null) => `${applyUrl ?? 'https://launchyournextchapter.com/dashboard/internal-roles'}#nc-internal-${randomUUID()}`
export const applyLinkOf = (url: string) => (url.includes('#nc-internal-') && !url.startsWith('https://launchyournextchapter.com/dashboard/internal-roles') ? url.split('#nc-internal-')[0] : null)

export async function createInternalRole(orgId: string, orgName: string, addedBy: string, input: InternalRoleInput) {
  return prisma.exclusiveJobPosting.create({
    data: {
      title: input.title,
      companyName: orgName,
      location: input.location,
      description: input.description,
      url: internalUrl(input.applyUrl),
      addedBy,
      status: INTERNAL_ROLE_STATUS,
      source: INTERNAL_ROLE_SOURCE,
      distribution: 'EXCLUDED',
      orgScopeId: orgId,
    },
    select: { id: true },
  })
}

const internalWhere = (orgId: string, extra: Prisma.ExclusiveJobPostingWhereInput = {}): Prisma.ExclusiveJobPostingWhereInput => ({ orgScopeId: orgId, status: INTERNAL_ROLE_STATUS, ...extra })

export async function listInternalRoles(orgId: string, opts: { openOnly?: boolean } = {}) {
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: internalWhere(orgId, opts.openOnly ? { archivedAt: null } : {}),
    orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    select: { id: true, title: true, location: true, description: true, url: true, createdAt: true, archivedAt: true },
  })
  const counts = rows.length ? await prisma.internalRoleInterest.groupBy({ by: ['postingId'], where: { postingId: { in: rows.map((r) => r.id) } }, _count: { _all: true } }) : []
  const n = new Map(counts.map((c) => [c.postingId, c._count._all]))
  return rows.map((r) => ({ ...r, applyUrl: applyLinkOf(r.url), interested: n.get(r.id) ?? 0 }))
}

export async function closeInternalRole(orgId: string, postingId: string, reopen = false) {
  const r = await prisma.exclusiveJobPosting.updateMany({ where: internalWhere(orgId, { id: postingId }), data: { archivedAt: reopen ? null : new Date() } })
  return r.count > 0
}

// The people who asked to be considered for this role. They chose to share
// their name and email with their employer by pressing the button that says so.
export async function interestedPeople(orgId: string, postingId: string) {
  const role = await prisma.exclusiveJobPosting.findFirst({ where: internalWhere(orgId, { id: postingId }), select: { id: true } })
  if (!role) return []
  const rows = await prisma.internalRoleInterest.findMany({ where: { postingId }, orderBy: { createdAt: 'asc' }, select: { id: true, note: true, createdAt: true, candidateId: true } })
  if (!rows.length) return []
  const people = await prisma.candidateProfile.findMany({ where: { id: { in: rows.map((r) => r.candidateId) } }, select: { id: true, firstName: true, lastName: true, userId: true } })
  const byId = new Map(people.map((p) => [p.id, p]))
  const admin = createAdminClient()
  return Promise.all(
    rows.map(async (r) => {
      const p = byId.get(r.candidateId)
      const email = p ? ((await admin.auth.admin.getUserById(p.userId)).data.user?.email ?? null) : null
      return { id: r.id, note: r.note, createdAt: r.createdAt, name: [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Name not set', email }
    })
  )
}

// ---- Courses (Learning) ---------------------------------------------------

export type CourseInput = { title: string; provider: string | null; url: string | null; skills: string[]; covered: string | null; note: string | null }

export function readCourse(f: FormData): CourseInput | { error: string } {
  const title = String(f.get('title') ?? '').trim().slice(0, 140)
  if (!title) return { error: 'Give the course a title.' }
  const urlRaw = String(f.get('url') ?? '').trim()
  let url: string | null = null
  if (urlRaw) {
    try {
      const u = new URL(urlRaw)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol')
      url = u.toString()
    } catch {
      return { error: 'The course link needs to be a full web address, starting with https://.' }
    }
  }
  const skills = String(f.get('skills') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
  return {
    title,
    provider: String(f.get('provider') ?? '').trim().slice(0, 80) || null,
    url,
    skills,
    covered: String(f.get('covered') ?? '').trim().slice(0, 80) || null,
    note: String(f.get('note') ?? '').trim().slice(0, 500) || null,
  }
}

// ---- The employee's side --------------------------------------------------

// Every Growth or Learning program behind this person's activated seats.
export async function staffProgramsForCandidate(candidateId: string) {
  const seats = await prisma.outplacementSeat.findMany({
    where: { candidateId, status: 'ACTIVATED', contract: { status: 'ACTIVE', programType: { in: ['GROWTH', 'LEARNING'] } } },
    select: { contract: { select: { programType: true, orgId: true, org: { select: { name: true, programBrandName: true } } } } },
  })
  const seen = new Set<string>()
  const out: { programType: OutplacementProgramType; orgId: string; orgName: string; name: string }[] = []
  for (const s of seats) {
    const k = `${s.contract.orgId}:${s.contract.programType}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ programType: s.contract.programType, orgId: s.contract.orgId, orgName: s.contract.org.name, name: s.contract.org.programBrandName ?? s.contract.org.name })
  }
  return out
}

export async function candidateOrgIds(candidateId: string, programType: OutplacementProgramType): Promise<string[]> {
  return (await staffProgramsForCandidate(candidateId)).filter((p) => p.programType === programType).map((p) => p.orgId)
}
