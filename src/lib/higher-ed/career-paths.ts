// Career paths for a college's students and recent graduates (owner, 2026-11-21): the entry-level jobs people with
// their major take, the skills and tools each one asks for (O*NET), which of those their résumé already shows, and the
// college's own programs, courses and services that teach the rest. Students and graduates of the last two years often
// have no job function yet, so this replaces the skills bridge (which measures against one) for them.
//
// Cost: one member, one profile, the occupations of at most ~6 roles (30 skill rows each) and the college's tagged
// offerings (at most 200 narrow rows), when the Learn tab opens.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { majorForFieldOfStudy } from '@/lib/early-career/major-roles'
import { rolesWithSkills } from '@/lib/early-career/data'
import { skillTerms } from '@/lib/profile/skill-matrix'
import { bridgeOfferings, normSkill, teaches, type BridgeOffering } from './skills-bridge'

export type PathSkill = { name: string; have: boolean; offerings: BridgeOffering[] }
export type PathRole = { title: string; skills: PathSkill[] }
export type CareerPaths = { state: 'ready'; majorLabel: string; roles: PathRole[] } | { state: 'no-major' | 'no-roles' }

/** Students, and alumni within two years of graduating (the skills bridge serves everyone else). */
export function wantsCareerPaths(m: { affiliation: string; classYear: number | null }, now = new Date()): boolean {
  return m.affiliation === 'STUDENT' || (m.classYear !== null && m.classYear >= now.getUTCFullYear() - 2)
}

/** Pure: mark what they show and attach offerings. Exported for tests. */
export function buildPaths(roles: { title: string; skills: string[]; tools: string[] }[], terms: string[], offerings: BridgeOffering[]): PathRole[] {
  const have = new Set(terms.map(normSkill))
  const shows = (s: string) => {
    const k = normSkill(s)
    return have.has(k) || [...have].some((t) => t.length > 3 && (k.includes(t) || t.includes(k)))
  }
  return roles
    .map((r) => ({
      title: r.title,
      skills: [...r.skills, ...r.tools].slice(0, 6).map((name) => {
        const own = shows(name)
        return { name, have: own, offerings: own ? [] : offerings.filter((o) => teaches(o, { name, slug: name.toLowerCase().replace(/\s+/g, '-') })) }
      }),
    }))
    .filter((r) => r.skills.length > 0)
}

export async function careerPaths(args: { institution: { id: string; slug: string }; memberId: string; enabledFeatures: unknown }): Promise<CareerPaths> {
  const m = await prisma.institutionMember.findUnique({
    where: { id: args.memberId },
    select: { major: true, school: true, candidate: { select: { primaryFunction: true, resumeKeywords: true, confirmedSkillsHave: true, certifications: true, skillLevels: true } } },
  })
  const major = majorForFieldOfStudy(m?.major)
  if (!m || !major) return { state: 'no-major' }
  const [roles, offerings] = await Promise.all([rolesWithSkills(major), bridgeOfferings(args.institution, args.enabledFeatures, { school: m.school })])
  const paths = buildPaths(roles, m.candidate ? skillTerms(m.candidate) : [], offerings)
  return paths.length ? { state: 'ready', majorLabel: m.major ?? major.label, roles: paths.slice(0, 4) } : { state: 'no-roles' }
}
