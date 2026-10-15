// A college's recruiting picture, per company: who recruits here every year (core
// recruiters), when they are on campus, and the internships and graduate jobs they
// have for its students. Extends the college's target-company list.
//
// PRIVATE to the institution, like InstitutionTargetCompany: every function takes the
// institutionId and filters on it. The one cross-institution read, schoolsWithCoreRecruiter,
// returns who has flagged a company and is for NextChapter admins only (the CRM page).

import 'server-only'
import { prisma } from '@/lib/prisma'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import { isLinkableCompanyName } from '@/lib/companies/posting-company'
import {
  RECRUITING_DATE_KINDS, EARLY_CAREER_KINDS, safeHttpUrl,
  type RecruitingDateKind, type EarlyCareerKind,
} from './recruiting-rules'

export async function setCoreRecruiter(input: {
  institutionId: string
  companyId: string
  core: boolean
  contactName?: string | null
  contactEmail?: string | null
}): Promise<{ ok: true } | { error: string }> {
  const email = input.contactEmail?.trim() || null
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid recruiter email, or leave it blank.' }
  const r = await prisma.institutionTargetCompany.updateMany({
    where: { institutionId: input.institutionId, companyId: input.companyId },
    data: { coreRecruiter: input.core, recruiterContactName: input.contactName?.trim() || null, recruiterContactEmail: email },
  })
  return r.count ? { ok: true } : { error: 'Add the company to your target list first.' }
}

/** The company's id, creating the directory row if needed; null when the name is not a company. */
async function companyIdFor(name: string | undefined): Promise<string | null> {
  if (!isLinkableCompanyName(name)) return null
  return (await getOrCreateCompany(name!)).id
}

export async function addRecruitingDate(input: {
  institutionId: string
  companyName: string
  kind: string
  title: string
  startsAt: string
  location?: string | null
  url?: string | null
  note?: string | null
  createdBy?: string | null
}): Promise<{ id: string; companyId: string } | { error: string }> {
  if (!(RECRUITING_DATE_KINDS as readonly string[]).includes(input.kind)) return { error: 'Choose what kind of date this is.' }
  if (!input.title.trim()) return { error: 'Give the date a title, such as "Fall career fair".' }
  // A date-time field has no zone; read it as entered so what staff typed is what shows.
  const startsAt = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(input.startsAt) ? input.startsAt : `${input.startsAt}Z`)
  if (Number.isNaN(startsAt.getTime())) return { error: 'Enter the date and time.' }
  const url = input.url?.trim() ? safeHttpUrl(input.url) : null
  if (input.url?.trim() && !url) return { error: 'The link must start with http:// or https://.' }
  const companyId = await companyIdFor(input.companyName)
  if (!companyId) return { error: 'Enter a company name.' }
  const row = await prisma.institutionRecruitingDate.create({
    data: {
      institutionId: input.institutionId, companyId, kind: input.kind, title: input.title.trim(), startsAt,
      location: input.location?.trim() || null, url, note: input.note?.trim() || null, createdBy: input.createdBy ?? null,
    },
    select: { id: true },
  })
  return { id: row.id, companyId }
}

export async function removeRecruitingDate(institutionId: string, id: string): Promise<void> {
  await prisma.institutionRecruitingDate.deleteMany({ where: { id, institutionId } })
}

export async function addEarlyCareerRole(input: {
  institutionId: string
  companyName: string
  kind: string
  title: string
  location?: string | null
  applyUrl?: string | null
  deadline?: string | null
  classYears?: string | null
  note?: string | null
  createdBy?: string | null
}): Promise<{ id: string; companyId: string } | { error: string }> {
  if (!(EARLY_CAREER_KINDS as readonly string[]).includes(input.kind)) return { error: 'Choose internship, co-op or entry-level.' }
  if (!input.title.trim()) return { error: 'Give the role a title.' }
  let deadline: Date | null = null
  if (input.deadline?.trim()) {
    deadline = new Date(input.deadline)
    if (Number.isNaN(deadline.getTime())) return { error: 'Enter a valid application deadline, or leave it blank.' }
  }
  const applyUrl = input.applyUrl?.trim() ? safeHttpUrl(input.applyUrl) : null
  if (input.applyUrl?.trim() && !applyUrl) return { error: 'The apply link must start with http:// or https://.' }
  const companyId = await companyIdFor(input.companyName)
  if (!companyId) return { error: 'Enter a company name.' }
  const row = await prisma.institutionEarlyCareerRole.create({
    data: {
      institutionId: input.institutionId, companyId, kind: input.kind, title: input.title.trim(),
      location: input.location?.trim() || null, applyUrl, deadline, classYears: input.classYears?.trim() || null,
      note: input.note?.trim() || null, createdBy: input.createdBy ?? null,
    },
    select: { id: true },
  })
  return { id: row.id, companyId }
}

export async function archiveEarlyCareerRole(institutionId: string, id: string): Promise<void> {
  await prisma.institutionEarlyCareerRole.updateMany({ where: { id, institutionId }, data: { archivedAt: new Date() } })
}

export interface RecruitingDateRow {
  id: string; companyId: string; company: string; kind: RecruitingDateKind; title: string
  startsAt: Date; location: string | null; url: string | null; note: string | null
}
export interface EarlyCareerRoleRow {
  id: string; companyId: string; company: string; kind: EarlyCareerKind; title: string
  location: string | null; applyUrl: string | null; deadline: Date | null; classYears: string | null; note: string | null
}

export async function listRecruitingDates(institutionId: string): Promise<RecruitingDateRow[]> {
  const rows = await prisma.institutionRecruitingDate.findMany({
    where: { institutionId },
    orderBy: { startsAt: 'asc' },
    take: 500,
    select: { id: true, companyId: true, kind: true, title: true, startsAt: true, location: true, url: true, note: true, company: { select: { name: true } } },
  })
  return rows.map((r) => ({ ...r, company: r.company.name, kind: r.kind as RecruitingDateKind }))
}

export async function listEarlyCareerRoles(institutionId: string): Promise<EarlyCareerRoleRow[]> {
  const rows = await prisma.institutionEarlyCareerRole.findMany({
    where: { institutionId, archivedAt: null },
    orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 500,
    select: { id: true, companyId: true, kind: true, title: true, location: true, applyUrl: true, deadline: true, classYears: true, note: true, company: { select: { name: true } } },
  })
  return rows.map((r) => ({ ...r, company: r.company.name, kind: r.kind as EarlyCareerKind }))
}

/**
 * Colleges that flag a company as a core recruiter. For the NextChapter admin's
 * company page only; never exposed to a college, a member or a candidate.
 */
export async function schoolsWithCoreRecruiter(companyId: string): Promise<{ institutionId: string; name: string; isDemo: boolean }[]> {
  const rows = await prisma.institutionTargetCompany.findMany({
    where: { companyId, coreRecruiter: true },
    select: { institution: { select: { id: true, name: true, isDemo: true } } },
  })
  return rows.map((r) => ({ institutionId: r.institution.id, name: r.institution.name, isDemo: r.institution.isDemo })).filter((r) => !r.isDemo)
}
