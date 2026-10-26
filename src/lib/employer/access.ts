import 'server-only'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EMPLOYER_SECTION_ORDER, type EmployerSectionKey } from '@/lib/employer/sections'

// Which employer sections a signed-in person holds, and their role in each (docs/specs/employer-sections-build-plan.md, 3.1).
//
// READ ONLY. These functions never write. getEmployerAccess is the union of:
//   1. Today's checks, which stay the source of truth and are always asked first (getLegacyGrants):
//        Hiring        EmployerProfile.userId, or an accepted EmployerSeat      (resolveEmployerForUserId)
//        Outplacement  OutplacementOrgUser.userId, any role                     (getCurrentOutplacementOrgUser)
//        Employees     the same OutplacementOrgUser when its role is ADMIN or VIEWER and the org has an ACTIVE
//                      GROWTH or LEARNING contract                              (the Growth and Learning pages)
//   2. New: OrgWorkspaceAdmin rows for the person (getWorkspaceGrants), by user id, or by email while the row has no user id yet.
//   3. Opt-in (includeLinked): the same two checks for accounts the person has linked with "Link my other account"
//      (EmployerAccountLink, status ACTIVE, either side). Those grants carry viaUserId so the bridge knows whose sign-in
//      they belong to. A link grants nothing itself; it only lets the chooser and bridge see the other account's grants.
// The new tables only ever add access. A person who holds a section today holds it here, with the same role.
// scripts/employer/access-diff.ts proves that against a database, read only.

export type AccessSource = 'hiring_owner' | 'hiring_seat' | 'outplacement_org_user' | 'workspace_admin'

/** One way a person holds a section. A person can hold the same section through more than one source. */
export interface SectionGrant {
  section: EmployerSectionKey
  source: AccessSource
  /** ADMIN | VIEWER | BILLING for Hiring and Employees; ADMIN | VIEWER | LEGAL | FINANCE for Outplacement. */
  role: string
  /** The legacy role name when it differs (Hiring: OWNER or MEMBER). */
  legacyRole?: string
  /** OutplacementEmployerOrg id (Employees, Outplacement) or EmployerProfile id (Hiring) the person works in. */
  recordId: string | null
  /** The Organization and OrgWorkspace, when the grant comes from OrgWorkspaceAdmin. */
  organizationId?: string
  workspaceId?: string
  /** Services switched on, for Employees: { retention, learning, retraining }. */
  services?: Record<string, boolean>
  /** The workspace's plan (FREE | PAID | CONTRACT | ENTERPRISE), when known. */
  plan?: string
  /** The organization has the enterprise package, which unlocks every section the person already holds. */
  enterprise?: boolean
  /** Set only on a grant that comes from a linked account: the user id that really holds it. Never set on the person's own grants. */
  viaUserId?: string
  /** The EmployerAccountLink that brought it in. */
  viaLinkId?: string
}

export interface EmployerAccess {
  userId: string
  /** Sections held, in display order (Hiring, Employees, Outplacement). */
  sections: EmployerSectionKey[]
  grants: SectionGrant[]
  /** Set when the new tables could not be read (not applied yet, or an error). Today's access is still complete. */
  warnings?: string[]
}

export interface EmployerAccessInput {
  userId: string
  /** The signed-in user's own email, used only to match OrgWorkspaceAdmin rows that have no user id yet. */
  email?: string | null
  /** Also include the grants of accounts linked to this one (default false: only the person's own, exactly as before). */
  includeLinked?: boolean
}

/** Only the read methods these functions use, so a caller (the diff script) can hand them a client that cannot write. */
export type EmployerAccessDb = Pick<PrismaClient, 'employerProfile' | 'employerSeat' | 'outplacementOrgUser' | 'outplacementContract' | 'orgWorkspaceAdmin' | 'employerAccountLink'>

interface WorkspaceAdminRow {
  role: string
  workspace: { id: string; orgId: string; type: string; refId: string | null; plan: string; services: unknown; org: { enterprise: boolean } }
}

const WORKSPACE_TYPE_TO_SECTION: Record<string, EmployerSectionKey> = { HIRING: 'hiring', EMPLOYEES: 'employees', OUTPLACEMENT: 'outplacement' }
const SEAT_ROLE_TO_HIRING_ROLE: Record<string, string> = { OWNER: 'ADMIN', MEMBER: 'VIEWER' }
const EMPLOYEES_LEGACY_ROLES = ['ADMIN', 'VIEWER']

function servicesFromJson(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = { learning: false, retention: false, retraining: false }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, on] of Object.entries(v as Record<string, unknown>)) out[k] = on === true
  }
  return out
}

/** Today's checks only (Hiring, Outplacement, Employees). The source of truth, always asked first. */
export async function getLegacyGrants(input: EmployerAccessInput, db: EmployerAccessDb = prisma): Promise<SectionGrant[]> {
  const { userId } = input
  const grants: SectionGrant[] = []

  // ── Legacy: Hiring ───────────────────────────────────────────────────────
  const owned = await db.employerProfile.findUnique({ where: { userId }, select: { id: true } })
  if (owned) {
    grants.push({ section: 'hiring', source: 'hiring_owner', role: 'ADMIN', legacyRole: 'OWNER', recordId: owned.id })
  } else {
    const seat = await db.employerSeat.findFirst({ where: { userId, acceptedAt: { not: null } }, select: { role: true, employerId: true } })
    if (seat) grants.push({ section: 'hiring', source: 'hiring_seat', role: SEAT_ROLE_TO_HIRING_ROLE[seat.role] ?? 'VIEWER', legacyRole: seat.role, recordId: seat.employerId })
  }

  // ── Legacy: Outplacement and Employees ───────────────────────────────────
  const orgUser = await db.outplacementOrgUser.findUnique({ where: { userId }, select: { role: true, orgId: true } })
  if (orgUser) {
    grants.push({ section: 'outplacement', source: 'outplacement_org_user', role: orgUser.role, recordId: orgUser.orgId })
    if (EMPLOYEES_LEGACY_ROLES.includes(orgUser.role)) {
      const contracts = await db.outplacementContract.findMany({
        where: { orgId: orgUser.orgId, status: 'ACTIVE', programType: { in: ['GROWTH', 'LEARNING'] } },
        select: { programType: true },
        distinct: ['programType'],
      })
      if (contracts.length) {
        const types = new Set(contracts.map((c) => c.programType))
        grants.push({
          section: 'employees',
          source: 'outplacement_org_user',
          role: orgUser.role,
          recordId: orgUser.orgId,
          services: { learning: types.has('LEARNING'), retention: types.has('GROWTH'), retraining: false },
        })
      }
    }
  }
  return grants
}

/** New, additive: OrgWorkspaceAdmin rows (ACTIVE workspaces only). Only ever added to the legacy grants. Fails soft. */
export async function getWorkspaceGrants(input: EmployerAccessInput, db: EmployerAccessDb = prisma): Promise<{ grants: SectionGrant[]; warnings: string[] }> {
  const { userId } = input
  const email = input.email?.trim().toLowerCase() || null
  const grants: SectionGrant[] = []
  const warnings: string[] = []
  let rows: WorkspaceAdminRow[] = []
  try {
    rows = await db.orgWorkspaceAdmin.findMany({
      where: {
        OR: [{ userId }, ...(email ? [{ userId: null, email: { equals: email, mode: 'insensitive' as const } }] : [])],
        workspace: { status: 'ACTIVE', type: { in: ['HIRING', 'EMPLOYEES', 'OUTPLACEMENT'] } },
      },
      select: {
        role: true,
        workspace: { select: { id: true, orgId: true, type: true, refId: true, plan: true, services: true, org: { select: { enterprise: true } } } },
      },
    })
  } catch (e) {
    // The new table is only ever a fallback and an addition. If it is missing or fails, today's access is still the answer.
    warnings.push(`OrgWorkspaceAdmin not readable: ${e instanceof Error ? e.message.split('\n').pop() : 'unknown error'}`)
  }
  for (const r of rows) {
    const section = WORKSPACE_TYPE_TO_SECTION[r.workspace.type]
    if (!section) continue
    grants.push({
      section,
      source: 'workspace_admin',
      role: r.role,
      recordId: r.workspace.refId,
      organizationId: r.workspace.orgId,
      workspaceId: r.workspace.id,
      ...(section === 'employees' ? { services: servicesFromJson(r.workspace.services) } : {}),
      plan: r.workspace.plan,
      enterprise: r.workspace.org.enterprise,
    })
  }
  return { grants, warnings }
}

/** New, additive, opt-in: the grants of accounts linked to this one. Only ACTIVE links count. Fails soft. */
export async function getLinkedGrants(input: EmployerAccessInput, db: EmployerAccessDb = prisma): Promise<{ grants: SectionGrant[]; warnings: string[] }> {
  const { userId } = input
  const grants: SectionGrant[] = []
  const warnings: string[] = []
  try {
    const links = await db.employerAccountLink.findMany({
      where: { status: 'ACTIVE', OR: [{ userId }, { otherUserId: userId }] },
      select: { id: true, userId: true, otherUserId: true },
      take: 5,
    })
    const seen = new Set<string>()
    for (const l of links) {
      const other = l.userId === userId ? l.otherUserId : l.userId
      if (!other || other === userId || seen.has(other)) continue
      seen.add(other)
      const [legacy, workspace] = await Promise.all([getLegacyGrants({ userId: other }, db), getWorkspaceGrants({ userId: other }, db)])
      warnings.push(...workspace.warnings)
      for (const g of [...legacy, ...workspace.grants]) grants.push({ ...g, viaUserId: other, viaLinkId: l.id })
    }
  } catch (e) {
    warnings.push(`EmployerAccountLink not readable: ${e instanceof Error ? e.message.split('\n').pop() : 'unknown error'}`)
    return { grants: [], warnings }
  }
  return { grants, warnings }
}

export async function getEmployerAccess(input: EmployerAccessInput, db: EmployerAccessDb = prisma): Promise<EmployerAccess> {
  const legacy = await getLegacyGrants(input, db)
  const { grants: added, warnings } = await getWorkspaceGrants(input, db)
  const linked = input.includeLinked ? await getLinkedGrants(input, db) : { grants: [] as SectionGrant[], warnings: [] as string[] }
  const grants = [...legacy, ...added, ...linked.grants]
  const allWarnings = [...warnings, ...linked.warnings]
  const held = new Set(grants.map((g) => g.section))
  return { userId: input.userId, sections: EMPLOYER_SECTION_ORDER.filter((s) => held.has(s)), grants, ...(allWarnings.length ? { warnings: allWarnings } : {}) }
}

/** The grants a person holds in one section. Legacy grants come first, so the first one is the one today's checks give. */
export function grantsFor(access: EmployerAccess, section: EmployerSectionKey): SectionGrant[] {
  return access.grants.filter((g) => g.section === section)
}

export function holdsSection(access: EmployerAccess, section: EmployerSectionKey): boolean {
  return access.sections.includes(section)
}
