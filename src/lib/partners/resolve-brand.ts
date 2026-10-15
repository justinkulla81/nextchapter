import 'server-only'
import type { Coach, EmployerProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readProgramSettings } from '@/lib/employer/program-settings'
import { mergeBrand, type PartnerBrand } from '@/lib/partners/brand'

// Turns what each portal already stores into the one PartnerBrand the shared
// shell reads. Each function is cheap and safe to call from a layout.

export function coachBrand(coach: Pick<Coach, 'firmName' | 'logoUrl' | 'accentColor'>): PartnerBrand {
  return mergeBrand({ name: coach.firmName, logoUrl: coach.logoUrl, accent: coach.accentColor })
}

export function talentBrand(employer: Pick<EmployerProfile, 'companyName' | 'logoUrl'>): PartnerBrand {
  return mergeBrand({ name: employer.companyName, logoUrl: employer.logoUrl })
}

export async function recruiterBrand(recruiter: { firmName: string | null; recruiterFirmId: string | null }): Promise<PartnerBrand> {
  const firm = recruiter.recruiterFirmId
    ? await prisma.recruiterFirm.findUnique({ where: { id: recruiter.recruiterFirmId }, select: { name: true, logoUrl: true, accentColor: true } })
    : null
  return mergeBrand({ name: firm?.name ?? recruiter.firmName, logoUrl: firm?.logoUrl, accent: firm?.accentColor })
}

export async function outplacementBrand(orgId: string): Promise<PartnerBrand> {
  const org = await prisma.outplacementEmployerOrg.findUnique({
    where: { id: orgId },
    select: { name: true, programBrandName: true, programSettings: true },
  })
  if (!org) return mergeBrand()
  const { brand } = readProgramSettings(org.programSettings)
  return mergeBrand({ name: org.programBrandName ?? org.name, logoUrl: brand.logoUrl, accent: brand.accentColor })
}
