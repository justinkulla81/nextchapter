import 'server-only'
import { prisma } from '@/lib/prisma'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import { isLinkableCompanyName } from '@/lib/companies/posting-company'

// An institution's career or advancement team can flag companies as targets —
// somewhere to place alumni, or to build a relationship with.
//
// PRIVATE to the institution: these rows are never shown to members, candidates,
// or other institutions, and everything here takes the institutionId explicitly
// and filters on it, so a caller cannot read another institution's list by
// accident. Authorising the caller as staff of that institution is the caller's
// job (the higher-ed portal's access layer); this module is the data layer.

export interface TargetCompany {
  companyId: string
  name: string
  industry: string | null
  note: string | null
  flaggedAt: Date
}

export async function listTargetCompanies(institutionId: string): Promise<TargetCompany[]> {
  const rows = await prisma.institutionTargetCompany.findMany({
    where: { institutionId },
    orderBy: { createdAt: 'desc' },
    select: { companyId: true, note: true, createdAt: true, company: { select: { name: true, industry: true } } },
  })
  return rows.map((r) => ({
    companyId: r.companyId,
    name: r.company.name,
    industry: r.company.industry,
    note: r.note,
    flaggedAt: r.createdAt,
  }))
}

export async function flagTargetCompany(input: {
  institutionId: string
  companyId?: string
  companyName?: string
  note?: string | null
  createdBy?: string | null
}): Promise<{ companyId: string } | { error: string }> {
  let companyId = input.companyId
  if (!companyId) {
    if (!isLinkableCompanyName(input.companyName)) return { error: 'Enter a company name.' }
    companyId = (await getOrCreateCompany(input.companyName)).id
  }
  await prisma.institutionTargetCompany.upsert({
    where: { institutionId_companyId: { institutionId: input.institutionId, companyId } },
    create: { institutionId: input.institutionId, companyId, note: input.note ?? null, createdBy: input.createdBy ?? null },
    update: { note: input.note ?? null },
  })
  return { companyId }
}

export async function unflagTargetCompany(institutionId: string, companyId: string): Promise<void> {
  await prisma.institutionTargetCompany.deleteMany({ where: { institutionId, companyId } })
}
