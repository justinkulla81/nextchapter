import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { resolveOrCreateSchool } from '@/lib/education/school-link'
import { inferDegreeLevel } from '@/lib/education/school-match'
import type { EarlyCareerAudience } from './audience'
import { checklistRows, type ChecklistRow } from './checklist'
import { majorForFieldOfStudy, MAJORS, type MajorEntry } from './major-roles'
import { pickEarlyPay, type EarlyPay } from './pay'

export type EducationSummary = {
  id: string
  schoolName: string
  degree: string | null
  fieldOfStudy: string | null
  graduationYear: number | null
}

export type RoleWithSkills = { title: string; soc?: string; occupationTitle: string | null; skills: string[]; tools: string[] }

export type EarlyCareerView = {
  audience: EarlyCareerAudience
  checklist: ChecklistRow[]
  education: EducationSummary | null
  major: MajorEntry | null
  roles: RoleWithSkills[]
  pay: EarlyPay | null
  primaryFunction: string | null
  targetRoleType: string | null
}

type ProfileForView = {
  id: string
  primaryFunction: string | null
  targetRoleType: string | null
  earlyCareerChecklistDone: string[]
  linkedInUrl: string | null
  linkedinConnectionsImportedAt: Date | null
}

/** The primary education entry, else the most recent one. */
export async function getPrimaryEducation(candidateId: string): Promise<EducationSummary | null> {
  const e = await prisma.educationEntry.findFirst({
    where: { candidateId },
    orderBy: [{ isPrimary: 'desc' }, { graduationDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    select: { id: true, schoolName: true, degree: true, fieldOfStudy: true, graduationDate: true },
  })
  if (!e) return null
  return { id: e.id, schoolName: e.schoolName, degree: e.degree, fieldOfStudy: e.fieldOfStudy, graduationYear: e.graduationDate?.getUTCFullYear() ?? null }
}

/** O*NET skills (top by importance) for each role's occupation, from the imported tables. */
export async function rolesWithSkills(major: MajorEntry): Promise<RoleWithSkills[]> {
  const socs = [...new Set(major.roles.map((r) => r.soc).filter((s): s is string => !!s))]
  const occs = socs.length
    ? await prisma.occupation.findMany({
        where: { socCode: { in: socs } },
        select: {
          socCode: true,
          title: true,
          // O*NET skills first; some occupations only have tools imported, so
          // in-demand tools (hotTech) fill in.
          skills: {
            where: { OR: [{ skill: { kind: 'SKILL' } }, { hotTech: true }] },
            orderBy: { importance: 'desc' },
            take: 30,
            select: { hotTech: true, skill: { select: { name: true, kind: true } } },
          },
        },
      })
    : []
  const bySoc = new Map(occs.map((o) => [o.socCode, o]))
  return major.roles.map((r) => {
    const o = r.soc ? bySoc.get(r.soc) : undefined
    const skills = o ? o.skills.filter((s) => s.skill.kind === 'SKILL').slice(0, 3).map((s) => s.skill.name) : []
    const tools = o ? o.skills.filter((s) => s.skill.kind === 'TECHNOLOGY' && s.hotTech).slice(0, 3).map((s) => s.skill.name) : []
    return { title: r.title, soc: r.soc, occupationTitle: o?.title ?? null, skills, tools }
  })
}

export async function loadEarlyCareerView(profile: ProfileForView, audience: EarlyCareerAudience, majorKey?: string | null): Promise<EarlyCareerView> {
  const [education, resumeCount, watchCount, payRows] = await Promise.all([
    getPrimaryEducation(profile.id),
    prisma.resume.count({ where: { candidateId: profile.id } }),
    prisma.companyWatchlistEntry.count({ where: { candidateId: profile.id } }),
    prisma.payBenchmark.findMany({
      where: { geo: 'US', seniorityGroup: { in: ['ENTRY_LEVEL', 'EARLY_CAREER', 'MID_LEVEL'] }, fn: { in: [profile.primaryFunction ?? '*', '*'] } },
      select: { fn: true, seniorityGroup: true, p25: true, p50: true, p75: true, sampleSize: true },
    }),
  ])
  const major = (majorKey ? MAJORS.find((m) => m.key === majorKey) : null) ?? majorForFieldOfStudy(education?.fieldOfStudy)
  const roles = major ? await rolesWithSkills(major) : []
  const checklist = checklistRows(audience, profile.earlyCareerChecklistDone, {
    hasEducation: !!education,
    hasResume: resumeCount > 0,
    hasLinkedIn: !!profile.linkedInUrl || profile.linkedinConnectionsImportedAt !== null,
    hasTargetRole: !!profile.targetRoleType?.trim(),
    trackedCompanies: watchCount,
  })
  return {
    audience,
    checklist,
    education,
    major,
    roles,
    pay: pickEarlyPay(payRows, audience, profile.primaryFunction),
    primaryFunction: profile.primaryFunction,
    targetRoleType: profile.targetRoleType,
  }
}

import type { EducationInput } from './data-types'
export type { EducationInput }

/**
 * Saves the member's school as their primary education entry: updates the
 * primary (or latest) entry when one exists, otherwise creates one. The
 * school is linked to its canonical School so alumni grouping works.
 */
export async function saveMemberEducation(candidateId: string, input: EducationInput): Promise<void> {
  let schoolId: string | null = null
  try {
    schoolId = (await resolveOrCreateSchool(input.schoolName))?.schoolId ?? null
  } catch (error) {
    console.error('Could not resolve school:', error)
  }
  const graduationDate = input.graduationYear ? new Date(Date.UTC(input.graduationYear, 4, 15)) : null
  const data = {
    schoolName: input.schoolName,
    schoolNameNormalized: normalizeOrgName(input.schoolName),
    schoolId,
    degree: input.degree,
    degreeLevel: inferDegreeLevel(input.degree),
    fieldOfStudy: input.fieldOfStudy,
    graduationDate,
  }
  const existing = await getPrimaryEducation(candidateId)
  if (existing) {
    await prisma.educationEntry.update({ where: { id: existing.id }, data: { ...data, isPrimary: true } })
  } else {
    await prisma.educationEntry.create({ data: { candidateId, ...data, isPrimary: true } })
  }
}
