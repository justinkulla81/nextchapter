import type { PrismaClient } from '@prisma/client'
import { uniqueSlug } from '@/lib/organizations/slug'
import { CONSUMER_EMAIL_DOMAINS_EXTENDED } from '@/lib/email/consumer-domains'
import { planAdmins, planWorkspaces, type AdminPlan, type HiringPersonRow, type OrgUserRow, type WorkspacePlan, type WorkspaceRow } from './backfill-lib'

// Runs the plans from backfill-lib.ts. `reader` is only ever used to read (the scripts hand it a client wrapped by
// readOnlyDb, which throws on any write). `writer` is touched ONLY when apply is true. In a dry run nothing reaches it.

type Reader = Pick<PrismaClient, 'outplacementEmployerOrg' | 'outplacementContract' | 'orgWorkspace' | 'orgWorkspaceAdmin' | 'outplacementOrgUser' | 'employerProfile' | 'employerSeat' | 'organization'>
type Writer = Pick<PrismaClient, 'orgWorkspace' | 'orgWorkspaceAdmin' | 'organization'>

export interface RunOptions {
  apply: boolean
}

const isUnique = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'

async function loadWorkspaces(reader: Reader): Promise<WorkspaceRow[]> {
  return reader.orgWorkspace.findMany({
    where: { type: { in: ['HIRING', 'EMPLOYEES', 'OUTPLACEMENT'] } },
    select: { id: true, orgId: true, type: true, refId: true, status: true, plan: true, planSource: true, services: true },
  })
}

// ── Step 3 ───────────────────────────────────────────────────────────────────

export interface WorkspaceRunResult {
  plan: WorkspacePlan
  applied: { created: number; updated: number; alreadyExisted: number; organizationsCreated: number } | null
}

export async function runWorkspaceBackfill(reader: Reader, writer: Writer, opts: RunOptions & { createOrganizationsFor?: string[] }): Promise<WorkspaceRunResult> {
  const [orgs, contracts, workspaces] = await Promise.all([
    reader.outplacementEmployerOrg.findMany({ select: { id: true, name: true, primaryContactEmail: true, isSampleData: true } }),
    reader.outplacementContract.findMany({ select: { orgId: true, programType: true, status: true } }),
    loadWorkspaces(reader),
  ])
  const plan = planWorkspaces({ orgs, contracts, workspaces })
  if (!opts.apply) return { plan, applied: null }

  const applied = { created: 0, updated: 0, alreadyExisted: 0, organizationsCreated: 0 }

  // Organizations are created ONLY for ids on the reviewed list the person passed in. Never from the plan alone.
  const approved = new Set(opts.createOrganizationsFor ?? [])
  for (const o of plan.withoutOrganization.filter((x) => approved.has(x.id))) {
    const domain = o.primaryContactEmail.split('@')[1]?.toLowerCase() ?? null
    const taken = new Set((await reader.organization.findMany({ select: { slug: true } })).map((x) => x.slug))
    const organization = await writer.organization.create({
      data: { name: o.name, slug: uniqueSlug(o.name, (s) => taken.has(s) || s.length < 3), domain: domain && !CONSUMER_EMAIL_DOMAINS_EXTENDED.has(domain) ? domain : null },
      select: { id: true },
    })
    await writer.orgWorkspace.create({ data: { orgId: organization.id, type: 'OUTPLACEMENT', refId: o.id, status: 'ACTIVE' } })
    applied.organizationsCreated++
    // The next run (or the line below) sees it; plan the rest of its workspaces now.
    const fresh = planWorkspaces({
      orgs: orgs.filter((x) => x.id === o.id),
      contracts,
      workspaces: [...workspaces, { id: 'new', orgId: organization.id, type: 'OUTPLACEMENT', refId: o.id, status: 'ACTIVE', plan: 'FREE', planSource: null, services: {} }],
    })
    for (const op of fresh.ops) {
      if (op.kind === 'create_workspace') {
        await writer.orgWorkspace.create({ data: { orgId: op.organizationId, ...op.data } })
        applied.created++
      }
    }
  }

  for (const op of plan.ops) {
    if (op.kind === 'create_workspace') {
      try {
        await writer.orgWorkspace.create({ data: { orgId: op.organizationId, ...op.data } })
        applied.created++
      } catch (e) {
        if (!isUnique(e)) throw e
        applied.alreadyExisted++
      }
    } else {
      await writer.orgWorkspace.update({ where: { id: op.workspaceId }, data: op.data })
      applied.updated++
    }
  }
  return { plan, applied }
}

// ── Step 4 ───────────────────────────────────────────────────────────────────

export interface AdminRunResult {
  plan: AdminPlan
  applied: { created: number; alreadyExisted: number } | null
}

export async function runAdminBackfill(reader: Reader, writer: Writer, opts: RunOptions, lookupEmail: (userId: string) => Promise<string | null>): Promise<AdminRunResult> {
  const [orgUsers, profiles, seats, workspaces, existing] = await Promise.all([
    reader.outplacementOrgUser.findMany({ select: { orgId: true, role: true, invitedEmail: true, userId: true, acceptedAt: true } }),
    reader.employerProfile.findMany({ select: { id: true, userId: true, createdAt: true } }),
    reader.employerSeat.findMany({ select: { employerId: true, role: true, invitedEmail: true, userId: true, acceptedAt: true } }),
    loadWorkspaces(reader),
    reader.orgWorkspaceAdmin.findMany({ select: { workspaceId: true, email: true } }),
  ])
  const hiring: HiringPersonRow[] = []
  for (const p of profiles) hiring.push({ profileId: p.id, kind: 'owner', email: await lookupEmail(p.userId), userId: p.userId, role: 'ADMIN', acceptedAt: p.createdAt })
  for (const s of seats) hiring.push({ profileId: s.employerId, kind: 'seat', email: s.invitedEmail, userId: s.userId, role: s.role === 'OWNER' ? 'ADMIN' : 'VIEWER', acceptedAt: s.acceptedAt })

  const plan = planAdmins({ orgUsers: orgUsers as OrgUserRow[], hiring, workspaces, existing })
  if (!opts.apply) return { plan, applied: null }

  const applied = { created: 0, alreadyExisted: 0 }
  for (const op of plan.ops) {
    try {
      await writer.orgWorkspaceAdmin.create({ data: { workspaceId: op.workspaceId, email: op.email, role: op.role, userId: op.userId, acceptedAt: op.acceptedAt, source: op.source } })
      applied.created++
    } catch (e) {
      if (!isUnique(e)) throw e
      applied.alreadyExisted++
    }
  }
  return { plan, applied }
}
