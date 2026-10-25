// The planning half of the employer-sections backfills (build plan steps 3 and 4). Pure: it takes rows that were read and
// returns the operations that WOULD bring the data in line. Nothing here talks to a database. The scripts print the plan
// (dry run, the default) and only with --apply hand the same operations to `applyOperations`.
//
// Every operation is additive and idempotent: it creates something that does not exist, fills a field that is empty, or
// fills a service key that is missing. It never deletes, never overwrites a value staff or a customer set, and running it twice
// plans nothing the second time.

export type WorkspaceKind = 'HIRING' | 'EMPLOYEES' | 'OUTPLACEMENT'

export interface OutOrgRow {
  id: string
  name: string
  primaryContactEmail: string
  isSampleData: boolean
}
export interface ContractRow {
  orgId: string
  programType: 'OUTPLACEMENT' | 'GROWTH' | 'LEARNING'
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
}
export interface WorkspaceRow {
  id: string
  orgId: string
  type: string
  refId: string | null
  status: string
  plan: string
  planSource: string | null
  services: unknown
}

// ── Step 3: workspaces ───────────────────────────────────────────────────────

export type WorkspaceOp =
  | { kind: 'update_workspace'; workspaceId: string; why: string; data: { plan?: string; planSource?: string; planUpdatedAt?: Date; refId?: string; services?: Record<string, boolean> } }
  | { kind: 'create_workspace'; organizationId: string; why: string; data: { type: WorkspaceKind; refId: string; status: 'ACTIVE'; plan: string; planSource: string; planUpdatedAt: Date; services: Record<string, boolean> } }

export interface WorkspacePlan {
  ops: WorkspaceOp[]
  /** Outplacement orgs with no Organization yet. Reported, never created without a reviewed list. */
  withoutOrganization: Array<{ id: string; name: string; primaryContactEmail: string }>
  /** Things that look wrong and are left alone for a person to decide. */
  conflicts: string[]
  skippedSampleOrgs: number
}

function servicesObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** Services from today's ACTIVE contracts: GROWTH is retention, LEARNING is learning and development; retraining is not built. */
export function servicesFromContracts(contracts: ContractRow[]): Record<string, boolean> {
  const active = new Set(contracts.filter((c) => c.status === 'ACTIVE').map((c) => c.programType))
  return { learning: active.has('LEARNING'), retention: active.has('GROWTH'), retraining: false }
}

export function planWorkspaces(input: { orgs: OutOrgRow[]; contracts: ContractRow[]; workspaces: WorkspaceRow[]; now?: Date }): WorkspacePlan {
  const now = input.now ?? new Date()
  const ops: WorkspaceOp[] = []
  const withoutOrganization: WorkspacePlan['withoutOrganization'] = []
  const conflicts: string[] = []
  let skippedSampleOrgs = 0

  for (const org of input.orgs) {
    if (org.isSampleData) {
      skippedSampleOrgs++
      continue
    }
    const mine = input.contracts.filter((c) => c.orgId === org.id)
    const outplacementWs = input.workspaces.find((w) => w.type === 'OUTPLACEMENT' && w.refId === org.id)
    if (!outplacementWs) {
      withoutOrganization.push({ id: org.id, name: org.name, primaryContactEmail: org.primaryContactEmail })
      continue
    }

    // Plan from today's facts: an outplacement contract was sold, so the section is on a contract. Never overwrites a plan someone set.
    if (outplacementWs.plan === 'FREE' && !outplacementWs.planSource && mine.some((c) => c.programType === 'OUTPLACEMENT')) {
      ops.push({ kind: 'update_workspace', workspaceId: outplacementWs.id, why: 'outplacement contract exists', data: { plan: 'CONTRACT', planSource: 'CONTRACT', planUpdatedAt: now } })
    }

    // Employees: one workspace per organization with a GROWTH or LEARNING contract, services set from the contracts.
    const hasEmployeesContract = mine.some((c) => c.status === 'ACTIVE' && (c.programType === 'GROWTH' || c.programType === 'LEARNING'))
    if (!hasEmployeesContract) continue
    const computed = servicesFromContracts(mine)
    const existing = input.workspaces.find((w) => w.orgId === outplacementWs.orgId && w.type === 'EMPLOYEES')
    if (!existing) {
      ops.push({
        kind: 'create_workspace',
        organizationId: outplacementWs.orgId,
        why: 'GROWTH or LEARNING contract exists',
        data: { type: 'EMPLOYEES', refId: org.id, status: 'ACTIVE', plan: 'CONTRACT', planSource: 'CONTRACT', planUpdatedAt: now, services: computed },
      })
      continue
    }
    if (existing.refId && existing.refId !== org.id) {
      conflicts.push(`Employees workspace ${existing.id} points at ${existing.refId}, not ${org.id} (${org.name}); left alone.`)
      continue
    }
    const data: Extract<WorkspaceOp, { kind: 'update_workspace' }>['data'] = {}
    if (!existing.refId) data.refId = org.id
    // Fill only service keys that are missing, so a service staff turned off is not turned back on.
    const have = servicesObject(existing.services)
    const missing = Object.entries(computed).filter(([k]) => !(k in have))
    if (missing.length) data.services = { ...(have as Record<string, boolean>), ...Object.fromEntries(missing) }
    if (existing.plan === 'FREE' && !existing.planSource) {
      data.plan = 'CONTRACT'
      data.planSource = 'CONTRACT'
      data.planUpdatedAt = now
    }
    if (Object.keys(data).length) ops.push({ kind: 'update_workspace', workspaceId: existing.id, why: 'fill empty fields from contracts', data })
  }
  return { ops, withoutOrganization, conflicts, skippedSampleOrgs }
}

// ── Step 4: workspace admins ─────────────────────────────────────────────────

export interface OrgUserRow {
  orgId: string
  role: 'ADMIN' | 'VIEWER' | 'LEGAL' | 'FINANCE'
  invitedEmail: string
  userId: string | null
  acceptedAt: Date | null
}
export interface HiringPersonRow {
  profileId: string
  /** The account owner (EmployerProfile) or an invited teammate (EmployerSeat). */
  kind: 'owner' | 'seat'
  /** From the Supabase user (the profile itself stores no email). Null when it could not be looked up. */
  email: string | null
  userId: string | null
  role: 'ADMIN' | 'VIEWER'
  acceptedAt: Date | null
}
export interface AdminRow {
  workspaceId: string
  email: string
}

export interface AdminOp {
  workspaceId: string
  email: string
  role: string
  userId: string | null
  acceptedAt: Date | null
  source: 'MIGRATED'
  from: 'OutplacementOrgUser' | 'EmployerProfile' | 'EmployerSeat'
}

export interface AdminPlan {
  ops: AdminOp[]
  alreadyThere: number
  /** Not copied, with the reason. */
  skipped: string[]
}

/** Employees takes ADMIN and VIEWER only; LEGAL and FINANCE exist only in Outplacement. */
export function employeesRoleFor(role: OrgUserRow['role']): 'ADMIN' | 'VIEWER' | null {
  return role === 'ADMIN' || role === 'VIEWER' ? role : null
}

export function planAdmins(input: { orgUsers: OrgUserRow[]; hiring: HiringPersonRow[]; workspaces: WorkspaceRow[]; existing: AdminRow[] }): AdminPlan {
  const ops: AdminOp[] = []
  const skipped: string[] = []
  let alreadyThere = 0
  const have = new Set(input.existing.map((a) => `${a.workspaceId}|${a.email.toLowerCase()}`))
  const planned = new Set<string>()
  const add = (op: AdminOp) => {
    const key = `${op.workspaceId}|${op.email}`
    if (have.has(key)) return void alreadyThere++
    if (planned.has(key)) return
    planned.add(key)
    ops.push(op)
  }

  for (const u of input.orgUsers) {
    const email = u.invitedEmail.trim().toLowerCase()
    const out = input.workspaces.find((w) => w.type === 'OUTPLACEMENT' && w.refId === u.orgId)
    if (out) add({ workspaceId: out.id, email, role: u.role, userId: u.userId, acceptedAt: u.acceptedAt, source: 'MIGRATED', from: 'OutplacementOrgUser' })
    else skipped.push(`org user ${email}: org ${u.orgId} has no Outplacement workspace yet (run the workspace backfill first)`)
    const emp = input.workspaces.find((w) => w.type === 'EMPLOYEES' && w.refId === u.orgId)
    const empRole = employeesRoleFor(u.role)
    if (emp && empRole) add({ workspaceId: emp.id, email, role: empRole, userId: u.userId, acceptedAt: u.acceptedAt, source: 'MIGRATED', from: 'OutplacementOrgUser' })
  }

  for (const h of input.hiring) {
    const ws = input.workspaces.find((w) => w.type === 'HIRING' && w.refId === h.profileId)
    if (!ws) {
      skipped.push(`hiring account ${h.profileId}: no Hiring workspace points at it`)
      continue
    }
    if (!h.email) {
      skipped.push(`hiring account ${h.profileId}: no email could be read for the person`)
      continue
    }
    add({ workspaceId: ws.id, email: h.email.trim().toLowerCase(), role: h.role, userId: h.userId, acceptedAt: h.acceptedAt, source: 'MIGRATED', from: h.kind === 'owner' ? 'EmployerProfile' : 'EmployerSeat' })
  }
  return { ops, alreadyThere, skipped }
}
