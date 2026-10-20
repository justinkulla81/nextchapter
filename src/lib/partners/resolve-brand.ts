import 'server-only'
import type { Coach, EmployerProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readProgramSettings } from '@/lib/employer/program-settings'
import { mergeBrand, type PartnerBrand } from '@/lib/partners/brand'
import { organizationBrandFor } from '@/lib/organizations/service'
import type { PortalType } from '@/lib/organizations/portals'

// Turns what each portal already stores into the one PartnerBrand the shared
// shell reads. Each function is cheap and safe to call from a layout.

// An organization's own brand wins over what the portal stores for itself.
async function withOrganization(type: PortalType, refId: string, own: PartnerBrand): Promise<PartnerBrand> {
  const override = await organizationBrandFor(type, refId).catch(() => null)
  return override ? mergeBrand(override, own) : own
}

export async function coachBrand(coach: Pick<Coach, 'id' | 'firmName' | 'logoUrl' | 'accentColor'>): Promise<PartnerBrand> {
  return withOrganization('COACH', coach.id, mergeBrand({ name: coach.firmName, logoUrl: coach.logoUrl, accent: coach.accentColor }))
}

export async function talentBrand(employer: Pick<EmployerProfile, 'id' | 'companyName' | 'logoUrl'>): Promise<PartnerBrand> {
  return withOrganization('HIRING', employer.id, mergeBrand({ name: employer.companyName, logoUrl: employer.logoUrl }))
}

export async function recruiterBrand(recruiter: { firmName: string | null; recruiterFirmId: string | null }): Promise<PartnerBrand> {
  const firm = recruiter.recruiterFirmId
    ? await prisma.recruiterFirm.findUnique({ where: { id: recruiter.recruiterFirmId }, select: { name: true, logoUrl: true, accentColor: true } })
    : null
  const own = mergeBrand({ name: firm?.name ?? recruiter.firmName, logoUrl: firm?.logoUrl, accent: firm?.accentColor })
  return recruiter.recruiterFirmId ? withOrganization('RECRUITER', recruiter.recruiterFirmId, own) : own
}

export async function outplacementBrand(orgId: string): Promise<PartnerBrand> {
  const org = await prisma.outplacementEmployerOrg.findUnique({
    where: { id: orgId },
    select: { name: true, programBrandName: true, programSettings: true },
  })
  if (!org) return mergeBrand()
  const { brand } = readProgramSettings(org.programSettings)
  return withOrganization('OUTPLACEMENT', orgId, mergeBrand({ name: org.programBrandName ?? org.name, logoUrl: brand.logoUrl, accent: brand.accentColor }))
}
