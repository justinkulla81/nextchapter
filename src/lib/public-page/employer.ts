import 'server-only'
import { prisma } from '@/lib/prisma'

// Which public page an employer's portal writes to, and whether its plan includes it (owner decision 2026-11-17: editing
// the public page is for a paid account). The page belongs to the CRM organization the portal is linked to: through its
// organization workspace when there is one, otherwise through the directory Company.
//  - Hiring is paid when its workspace's plan is not FREE.
//  - Employees and Outplacement are contract-based: paid while a contract is active.

export type EmployerPageAccess = { crmOrgId: string | null; paid: boolean }

async function crmOrgForCompany(companyId: string | null | undefined): Promise<string | null> {
  if (!companyId) return null
  const o = await prisma.crmOrganization.findFirst({ where: { companyId }, select: { id: true }, orderBy: { createdAt: 'asc' } })
  return o?.id ?? null
}

export async function hiringPageAccess(employer: { id: string; companyId: string | null }): Promise<EmployerPageAccess> {
  const ws = await prisma.orgWorkspace.findFirst({ where: { type: 'HIRING', refId: employer.id }, select: { plan: true, org: { select: { crmOrganizationId: true } } } })
  return { crmOrgId: ws?.org.crmOrganizationId ?? (await crmOrgForCompany(employer.companyId)), paid: !!ws && ws.plan !== 'FREE' }
}

export async function outplacementPageAccess(orgId: string): Promise<EmployerPageAccess> {
  const [ws, org, contracts] = await Promise.all([
    prisma.orgWorkspace.findFirst({ where: { type: { in: ['OUTPLACEMENT', 'EMPLOYEES'] }, refId: orgId }, select: { org: { select: { crmOrganizationId: true } } } }),
    prisma.outplacementEmployerOrg.findUnique({ where: { id: orgId }, select: { companyId: true } }),
    prisma.outplacementContract.count({ where: { orgId, status: 'ACTIVE' } }),
  ])
  return { crmOrgId: ws?.org.crmOrganizationId ?? (await crmOrgForCompany(org?.companyId)), paid: contracts > 0 }
}
