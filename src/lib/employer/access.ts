import 'server-only'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EMPLOYER_SECTION_ORDER, type EmployerSectionKey } from '@/lib/employer/sections'

// Which employer sections a signed-in person holds, and their role in each (docs/specs/employer-sections-build-plan.md, 3.1).
//
// READ ONLY. This function never writes, and nothing that signs anyone in calls it. It is the union of:
//   1. Today's checks, which stay the source of truth:
//        Hiring        EmployerProfile.userId, or an accepted EmployerSeat      (resolveEmployerForUserId)
//        Outplacement  OutplacementOrgUser.userId, any role                     (getCurrentOutplacementOrgUser)
//        Employees     the same OutplacementOrgUser when its role is ADMIN or VIEWER and the org has an ACTIVE
//                      GROWTH or LEARNING contract                              (the Growth and Learning pages)
//   2. New: OrgWorkspaceAdmin rows for the person (by user id, or by email while the row has no user id yet).
// The new table only ever adds access. A person who holds a section today holds it here, with the same role.
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
}

/** Only the read methods this function uses, so a caller (the diff script) can hand it a client that cannot write. */
export type EmployerAccessDb = Pick<PrismaClient, 'employerProfile' | 'employerSeat' | 'outplacementOrgUser' | 'outplacementContract' | 'orgWorkspaceAdmin'>

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

export async function getEmployerAccess(input: EmployerAccessInput, db: EmployerAccessDb = prisma): Promise<EmployerAccess> {
  const { userId } = input
  const email = input.email?.trim().toLowerCase() || null
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

  // ── New, additive: OrgWorkspaceAdmin ─────────────────────────────────────
  let rows: WorkspaceAdminRow[] = []
  const warnings: string[] = []
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

  const held = new Set(grants.map((g) => g.section))
  return { userId, sections: EMPLOYER_SECTION_ORDER.filter((s) => held.has(s)), grants, ...(warnings.length ? { warnings } : {}) }
}

/** The grants a person holds in one section. Legacy grants come first, so the first one is the one today's checks give. */
export function grantsFor(access: EmployerAccess, section: EmployerSectionKey): SectionGrant[] {
  return access.grants.filter((g) => g.section === section)
}

export function holdsSection(access: EmployerAccess, section: EmployerSectionKey): boolean {
  return access.sections.includes(section)
}
