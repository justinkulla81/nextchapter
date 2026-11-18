import 'server-only'
// Education Hub, server side: the catalog an organization curates, the college programs it can pull in, and what a member is assigned.
// Every read is narrow and bounded (a few hundred small rows at most per organization).

import { prisma } from '@/lib/prisma'
import type { TrainingOffering } from '@prisma/client'
import { audienceMatches, type Who } from './training-rules'

export const MAX_OFFERINGS = 300

export type OfferingRow = Pick<TrainingOffering, 'id' | 'source' | 'title' | 'provider' | 'url' | 'summary' | 'skills' | 'industries' | 'functions' | 'levels' | 'hours' | 'priceCents' | 'wioaEligible' | 'ncCustom' | 'programId' | 'assignment' | 'status'>

const SELECT = { id: true, source: true, title: true, provider: true, url: true, summary: true, skills: true, industries: true, functions: true, levels: true, hours: true, priceCents: true, wioaEligible: true, ncCustom: true, programId: true, assignment: true, status: true } as const

/** The organization's active catalog, newest first. */
export async function listOfferings(institutionId: string): Promise<OfferingRow[]> {
  return prisma.trainingOffering.findMany({ where: { institutionId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: MAX_OFFERINGS, select: SELECT })
}

export type CollegeProgram = { programId: string; name: string; college: string; credential: string | null; priceCents: number; hours: number | null; wioaEligible: boolean; skills: string[]; summary: string | null }

/** Active programs of the colleges this organization has confirmed as partners, to pull into the catalog. At most 80 narrow rows. */
export async function partnerCollegePrograms(institutionId: string): Promise<CollegeProgram[]> {
  const partners = await prisma.ecosystemPartner.findMany({ where: { institutionId, status: 'CONFIRMED', linkedInstitutionId: { not: null } }, take: 20, select: { linkedInstitutionId: true, name: true } })
  const ids = partners.flatMap((p) => (p.linkedInstitutionId ? [p.linkedInstitutionId] : []))
  if (ids.length === 0) return []
  const programs = await prisma.program.findMany({
    where: { institutionId: { in: ids }, isActive: true, isSampleData: false },
    orderBy: { name: 'asc' },
    take: 80,
    select: { id: true, institutionId: true, name: true, credential: true, priceCents: true, hours: true, wioaEligible: true, skills: true, summary: true },
  })
  const nameOf = new Map(partners.map((p) => [p.linkedInstitutionId, p.name]))
  return programs.map((p) => ({ programId: p.id, name: p.name, college: nameOf.get(p.institutionId) ?? 'A partner college', credential: p.credential, priceCents: p.priceCents, hours: p.hours, wioaEligible: p.wioaEligible, skills: p.skills, summary: p.summary }))
}

export type AssignedTraining = { id: string; title: string; provider: string | null; url: string | null; org: string; source: string; why: string }

/**
 * What the organizations a person belongs to have assigned them: active ASSIGNED offerings whose audience fits them. Three
 * organizations and 100 offerings at most.
 */
export async function assignedTrainingFor(candidateId: string, who: Who): Promise<AssignedTraining[]> {
  const memberships = await prisma.institutionMember.findMany({
    where: { candidateId, status: { in: ['CLAIMED', 'ACTIVE'] }, institution: { orgType: { not: 'COLLEGE' } } },
    take: 3,
    select: { institutionId: true, institution: { select: { name: true, programBrandName: true } } },
  })
  if (memberships.length === 0) return []
  const rows = await prisma.trainingOffering.findMany({
    where: { institutionId: { in: memberships.map((m) => m.institutionId) }, status: 'ACTIVE', assignment: 'ASSIGNED' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, institutionId: true, source: true, title: true, provider: true, url: true, industries: true, functions: true, levels: true },
  })
  const orgOf = new Map(memberships.map((m) => [m.institutionId, m.institution.programBrandName ?? m.institution.name]))
  return rows
    .filter((r) => audienceMatches({ industries: r.industries, functions: r.functions, levels: r.levels }, who))
    .slice(0, 6)
    .map((r) => ({ id: r.id, title: r.title, provider: r.provider, url: r.url, org: orgOf.get(r.institutionId) ?? 'Your program', source: r.source, why: [r.functions[0], r.industries[0], r.levels[0]].filter(Boolean).join(' · ') || 'Chosen for everyone in your group' }))
}
