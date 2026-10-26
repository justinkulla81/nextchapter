import 'server-only'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EMPLOYER_SECTIONS, sectionForWorkspaceType, type EmployerSectionKey } from '@/lib/employer/sections'
import { SECTION_ROLES, isSectionRole } from '@/lib/employer/section-roles'

// What NextChapter staff can do to an employer section's workspace from the organization page, without SQL:
// activate or suspend it, link its portal record, and add a person to its team or make one from a request.
// STAFF ONLY: every caller is a Server Action that has already passed requireAdmin. Nothing here is reachable by a member.
//
// What these writes do and do not change (read before extending):
//  - They write only OrgWorkspace.status / refId and OrgWorkspaceAdmin rows. No login, cookie, middleware or
//    getEmployerAccess logic changes; getEmployerAccess reads these rows exactly as it already does.
//  - ACTIVE is what lets the section's admins in: getWorkspaceGrants only reads admin rows of workspaces whose status is
//    ACTIVE. For Outplacement and Employees the pages also need refId (the OutplacementEmployerOrg), so an active section
//    with no linked record gives its admins nothing to open.
//  - Nothing here creates a contract, seat, subscription or portal record. Linking only points at one that already exists.
//  - Nothing is written to anyone's Google account.

type Db = Pick<PrismaClient, 'orgWorkspace' | 'orgWorkspaceAdmin' | 'orgClaim' | 'organization' | 'outplacementEmployerOrg' | 'employerProfile'>

export const WORKSPACE_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number]

export interface StaffAdminRow {
  id: string
  email: string
  role: string
  /** INVITE | DOMAIN_CLAIM | MIGRATED */
  source: string
  /** Linked to a sign-in (userId set). Rows that only have an email are matched when that person signs in. */
  signedIn: boolean
  accepted: boolean
  addedOn: string
}

export interface StaffRequestRow {
  claimId: string
  name: string
  title: string
  email: string
  requestedOn: string
}

export interface StaffLinkedRecord {
  id: string
  name: string
  contactEmail: string | null
}

export interface StaffSectionView {
  workspaceId: string
  section: EmployerSectionKey
  label: string
  status: string
  refId: string | null
  /** Outplacement and Employees: the OutplacementEmployerOrg the section points at, when it exists. */
  linkedRecord: StaffLinkedRecord | null
  /** Hiring: the email the claim was made with, and whether that person has signed up (refId is set when they do). */
  inviteEmail: string | null
  hiringSignedUp: boolean | null
  hiringCompany: string | null
  admins: StaffAdminRow[]
  requests: StaffRequestRow[]
  requestsError: string | null
  roles: string[]
  /** Why Activate is not offered right now, in plain words. Null when it is. */
  activateBlockedReason: string | null
}

export interface StaffActor {
  userId: string
  email: string | null
}

export type StaffResult<T = object> = { error: string } | ({ error?: undefined } & T)

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function isWorkspaceStatus(v: unknown): v is WorkspaceStatus {
  return typeof v === 'string' && (WORKSPACE_STATUSES as readonly string[]).includes(v)
}

/**
 * Hiring goes live on its own: claimHiringWorkspace matches a PENDING workspace by the claimant's email at sign-up and then
 * sets refId and ACTIVE. Activating it by hand before that would stop the match, so it is held back until they sign up.
 */
export function activateBlockedReason(ws: { type: string; status: string; refId: string | null; inviteEmail: string | null }): string | null {
  if (ws.type === 'HIRING' && ws.status === 'PENDING' && ws.inviteEmail && !ws.refId) {
    return `This section goes live on its own when ${ws.inviteEmail} signs up for Hiring. Activating it now would stop that from working.`
  }
  return null
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function loadStaffSectionViews(organizationId: string, db: Db = prisma): Promise<{ views: StaffSectionView[]; error?: string }> {
  try {
    const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true, crmOrganizationId: true } })
    if (!org) return { views: [], error: 'Organization not found.' }
    const workspaces = await db.orgWorkspace.findMany({
      where: { orgId: organizationId, type: { in: EMPLOYER_SECTIONS.map((s) => s.workspaceType) } },
      select: { id: true, type: true, status: true, refId: true, inviteEmail: true, admins: { orderBy: { createdAt: 'asc' } } },
    })
    const refIds = workspaces.filter((w) => w.refId && w.type !== 'HIRING').map((w) => w.refId as string)
    const hiringIds = workspaces.filter((w) => w.refId && w.type === 'HIRING').map((w) => w.refId as string)
    const [records, profiles] = await Promise.all([
      refIds.length ? db.outplacementEmployerOrg.findMany({ where: { id: { in: refIds } }, select: { id: true, name: true, primaryContactEmail: true } }) : Promise.resolve([]),
      hiringIds.length ? db.employerProfile.findMany({ where: { id: { in: hiringIds } }, select: { id: true, companyName: true } }) : Promise.resolve([]),
    ])

    const views: StaffSectionView[] = []
    for (const sec of EMPLOYER_SECTIONS) {
      const w = workspaces.find((x) => x.type === sec.workspaceType)
      if (!w) continue
      const rec = w.type !== 'HIRING' && w.refId ? records.find((r) => r.id === w.refId) : undefined
      let requests: StaffRequestRow[] = []
      let requestsError: string | null = null
      if (org.crmOrganizationId) {
        try {
          const claims = await db.orgClaim.findMany({
            where: { crmOrganizationId: org.crmOrganizationId, section: sec.key, outcome: 'REQUESTED', verifiedAt: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 25,
            select: { id: true, name: true, title: true, email: true, createdAt: true },
          })
          const have = new Set(w.admins.map((a) => a.email.toLowerCase()))
          // A request whose person is already on the team has been dealt with.
          requests = claims.filter((c) => !have.has(c.email.trim().toLowerCase())).map((c) => ({ claimId: c.id, name: c.name, title: c.title, email: c.email, requestedOn: fmt(c.createdAt) }))
        } catch {
          requestsError = 'Requests could not be loaded. Reload the page; if it keeps failing, the claim columns may not be applied yet.'
        }
      }
      views.push({
        workspaceId: w.id,
        section: sec.key,
        label: sec.label,
        status: w.status,
        refId: w.refId,
        linkedRecord: rec ? { id: rec.id, name: rec.name, contactEmail: rec.primaryContactEmail } : null,
        inviteEmail: w.inviteEmail,
        hiringSignedUp: sec.key === 'hiring' ? !!w.refId : null,
        hiringCompany: sec.key === 'hiring' && w.refId ? (profiles.find((p) => p.id === w.refId)?.companyName ?? null) : null,
        admins: w.admins.map((a) => ({ id: a.id, email: a.email, role: a.role, source: a.source, signedIn: !!a.userId, accepted: !!a.acceptedAt || !!a.userId, addedOn: fmt(a.createdAt) })),
        requests,
        requestsError,
        roles: [...SECTION_ROLES[sec.key]],
        activateBlockedReason: activateBlockedReason(w),
      })
    }
    return { views }
  } catch (e) {
    console.error('loadStaffSectionViews failed:', e)
    return { views: [], error: 'The sections could not be loaded. Reload the page to try again.' }
  }
}

export interface RecordOption {
  id: string
  name: string
  contactEmail: string | null
  /** Already linked to a section of another organization; it cannot be linked a second time. */
  linkedElsewhere: boolean
}

/** Up to 20 existing OutplacementEmployerOrg records matching a name or contact email, for the link picker. */
export async function searchLinkableRecords(workspaceId: string, query: string, db: Db = prisma): Promise<StaffResult<{ options: RecordOption[] }>> {
  const q = query.trim()
  if (q.length < 2) return { options: [] }
  const ws = await db.orgWorkspace.findUnique({ where: { id: workspaceId }, select: { id: true, type: true } })
  if (!ws || (ws.type !== 'OUTPLACEMENT' && ws.type !== 'EMPLOYEES')) return { error: 'Only Outplacement and Employees link to an employer record.' }
  const rows = await db.outplacementEmployerOrg.findMany({
    where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { primaryContactEmail: { contains: q, mode: 'insensitive' } }] },
    orderBy: { name: 'asc' },
    take: 20,
    select: { id: true, name: true, primaryContactEmail: true },
  })
  const taken = rows.length ? await db.orgWorkspace.findMany({ where: { type: ws.type, refId: { in: rows.map((r) => r.id) }, id: { not: ws.id } }, select: { refId: true } }) : []
  const takenIds = new Set(taken.map((t) => t.refId))
  return { options: rows.map((r) => ({ id: r.id, name: r.name, contactEmail: r.primaryContactEmail, linkedElsewhere: takenIds.has(r.id) })) }
}

// ── Status ────────────────────────────────────────────────────────────────────

export interface StatusChange {
  organizationId: string
  workspaceId: string
  /** Where audit entries go: the portal record when linked, otherwise the workspace itself. */
  auditPortal: string
  auditRefId: string
  section: EmployerSectionKey
  from: string
  to: WorkspaceStatus
  /** People on the team, so the event can say how many would be let in. */
  adminCount: number
  changed: boolean
}

/** Staff set a section to ACTIVE (Activate, Reactivate) or SUSPENDED. PENDING is only ever how a section starts. */
export async function setWorkspaceStatus(input: { workspaceId: string; to: string }, db: Db = prisma): Promise<StaffResult<{ change: StatusChange }>> {
  if (input.to !== 'ACTIVE' && input.to !== 'SUSPENDED') return { error: 'Choose Activate or Suspend.' }
  const ws = await db.orgWorkspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true, orgId: true, type: true, status: true, refId: true, inviteEmail: true, _count: { select: { admins: true } } },
  })
  if (!ws) return { error: 'This section no longer exists. Reload the page.' }
  const section = sectionForWorkspaceType(ws.type)
  if (!section) return { error: 'Only Hiring, Employees and Outplacement can be changed here.' }
  const base = { organizationId: ws.orgId, workspaceId: ws.id, auditPortal: ws.type, auditRefId: ws.refId ?? ws.id, section: section.key, from: ws.status, to: input.to as WorkspaceStatus, adminCount: ws._count.admins }
  if (ws.status === input.to) return { change: { ...base, changed: false } }
  if (input.to === 'ACTIVE') {
    const blocked = activateBlockedReason(ws)
    if (blocked) return { error: blocked }
  }
  if (input.to === 'SUSPENDED' && ws.status === 'PENDING') return { error: 'A section that has not been activated has nothing to suspend.' }
  // Compare-and-set, so two staff members clicking at once cannot overwrite each other's change.
  const r = await db.orgWorkspace.updateMany({ where: { id: ws.id, status: ws.status }, data: { status: input.to } })
  if (r.count === 0) return { error: 'Someone else just changed this section. Reload the page.' }
  return { change: { ...base, changed: true } }
}

// ── Link ──────────────────────────────────────────────────────────────────────

export interface LinkChange {
  organizationId: string
  workspaceId: string
  auditPortal: string
  auditRefId: string
  section: EmployerSectionKey
  recordId: string | null
  previousRecordId: string | null
  recordName: string | null
}

/**
 * Point an Outplacement or Employees section at an existing OutplacementEmployerOrg (or, with recordId null, remove the
 * link). It never creates an organization, contract or seat. A record already linked to another organization's section of
 * the same type is refused. Hiring links itself when the claimant signs up and cannot be linked here.
 */
export async function linkWorkspaceRecord(input: { workspaceId: string; recordId: string | null }, db: Db = prisma): Promise<StaffResult<{ change: LinkChange }>> {
  const ws = await db.orgWorkspace.findUnique({ where: { id: input.workspaceId }, select: { id: true, orgId: true, type: true, refId: true } })
  if (!ws) return { error: 'This section no longer exists. Reload the page.' }
  const section = sectionForWorkspaceType(ws.type)
  if (!section || section.key === 'hiring') return { error: 'Hiring links itself when the person who claimed it signs up. Only Outplacement and Employees are linked here.' }
  const base = { organizationId: ws.orgId, workspaceId: ws.id, auditPortal: ws.type, section: section.key, previousRecordId: ws.refId }
  if (input.recordId === null) {
    if (!ws.refId) return { change: { ...base, auditRefId: ws.id, recordId: null, recordName: null } }
    await db.orgWorkspace.update({ where: { id: ws.id }, data: { refId: null } })
    return { change: { ...base, auditRefId: ws.refId, recordId: null, recordName: null } }
  }
  const record = await db.outplacementEmployerOrg.findUnique({ where: { id: input.recordId }, select: { id: true, name: true } })
  if (!record) return { error: 'That employer record no longer exists. Search again.' }
  const other = await db.orgWorkspace.findFirst({ where: { type: ws.type, refId: record.id, id: { not: ws.id } }, select: { id: true } })
  if (other) return { error: 'That record is already linked to another organization’s section. Pick a different one.' }
  if (ws.refId === record.id) return { change: { ...base, auditRefId: record.id, recordId: record.id, recordName: record.name } }
  await db.orgWorkspace.update({ where: { id: ws.id }, data: { refId: record.id } })
  return { change: { ...base, auditRefId: record.id, recordId: record.id, recordName: record.name } }
}

// ── Team ──────────────────────────────────────────────────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface AddedAdmin {
  organizationId: string
  workspaceId: string
  auditPortal: string
  auditRefId: string
  section: EmployerSectionKey
  adminId: string
  email: string
  role: string
  claimId: string | null
}

/**
 * Add a person to a section's team by email. They are matched to their sign-in by that email when they sign in; no email is
 * sent and nothing is granted beyond the role chosen. `source` says how they got there.
 */
export async function addWorkspaceAdmin(
  input: { workspaceId: string; email: string; role: string; actor: StaffActor; source?: 'INVITE' | 'DOMAIN_CLAIM'; claimId?: string | null },
  db: Db = prisma,
): Promise<StaffResult<{ added: AddedAdmin }>> {
  const email = input.email.trim().toLowerCase()
  if (!email) return { error: 'Enter the person’s email address.' }
  if (email.length > 254 || !EMAIL.test(email)) return { error: 'That does not look like an email address. Check it and try again.' }
  const ws = await db.orgWorkspace.findUnique({ where: { id: input.workspaceId }, select: { id: true, orgId: true, type: true, refId: true } })
  if (!ws) return { error: 'This section no longer exists. Reload the page.' }
  const section = sectionForWorkspaceType(ws.type)
  if (!section) return { error: 'Only Hiring, Employees and Outplacement have a team here.' }
  if (!isSectionRole(section.key, input.role)) return { error: `Choose one of the ${section.label} roles: ${SECTION_ROLES[section.key].join(', ')}.` }
  const existing = await db.orgWorkspaceAdmin.findFirst({ where: { workspaceId: ws.id, email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
  if (existing) return { error: 'That person is already on this team. Change their role instead.' }
  try {
    const row = await db.orgWorkspaceAdmin.create({
      data: { workspaceId: ws.id, email, role: input.role, source: input.source ?? 'INVITE', invitedBy: input.actor.userId },
      select: { id: true },
    })
    return { added: { organizationId: ws.orgId, workspaceId: ws.id, auditPortal: ws.type, auditRefId: ws.refId ?? ws.id, section: section.key, adminId: row.id, email, role: input.role, claimId: input.claimId ?? null } }
  } catch {
    return { error: 'That person was just added by someone else. Reload the page.' }
  }
}

/**
 * A pending claim request becomes an admin only when staff press Make admin. Checks that the request is a verified
 * REQUESTED claim for this organization's section; grants ADMIN to the email that was verified, nothing else.
 */
export async function makeAdminFromRequest(input: { claimId: string; actor: StaffActor }, db: Db = prisma): Promise<StaffResult<{ added: AddedAdmin }>> {
  const claim = await db.orgClaim.findUnique({
    where: { id: input.claimId },
    select: { id: true, crmOrganizationId: true, section: true, outcome: true, verifiedAt: true, email: true },
  })
  if (!claim) return { error: 'This request no longer exists. Reload the page.' }
  if (claim.outcome !== 'REQUESTED' || !claim.verifiedAt || !claim.section) return { error: 'This is not a verified request for a section, so it cannot be turned into an admin.' }
  const section = EMPLOYER_SECTIONS.find((s) => s.key === claim.section)
  if (!section) return { error: 'This request is for something that is not an employer section.' }
  const org = await db.organization.findUnique({ where: { crmOrganizationId: claim.crmOrganizationId }, select: { id: true } })
  if (!org) return { error: 'This request does not belong to an organization with sections yet.' }
  const ws = await db.orgWorkspace.findUnique({ where: { orgId_type: { orgId: org.id, type: section.workspaceType } }, select: { id: true } })
  if (!ws) return { error: 'That section does not exist for this organization.' }
  return addWorkspaceAdmin({ workspaceId: ws.id, email: claim.email, role: 'ADMIN', actor: input.actor, source: 'DOMAIN_CLAIM', claimId: claim.id }, db)
}

/** Everything the audit and event code needs about an admin row, read before it changes (the row is gone after a remove). */
export async function workspaceOfAdmin(adminId: string, db: Db = prisma): Promise<{ organizationId: string; auditPortal: string; auditRefId: string } | null> {
  const row = await db.orgWorkspaceAdmin.findUnique({ where: { id: adminId }, select: { workspace: { select: { id: true, orgId: true, type: true, refId: true } } } })
  if (!row) return null
  return { organizationId: row.workspace.orgId, auditPortal: row.workspace.type, auditRefId: row.workspace.refId ?? row.workspace.id }
}
