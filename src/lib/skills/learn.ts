// What a member can do to learn a skill, for a skill page: courses on our list that name it, and state-approved training
// programs that prepare for the jobs that name it most. Pure matching here (tests: src/test/skills-learn.test.ts); the
// reads are in learn-server.ts.

export interface SkillCourse {
  id: string
  title: string
  sponsor: string | null
  provider: string
  url: string
  free: boolean
  level: string
}

export interface CourseText { id: string; title: string; description: string; keywords: string[] }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whether a course's title, keywords or description name the skill as a whole term ("SQL" matches "SQL for analysts", not "MySQL"). */
export function courseNamesSkill(c: CourseText, skillName: string): boolean {
  const name = skillName.trim()
  if (name.length < 2) return false
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(name)}($|[^a-z0-9])`, 'i')
  return re.test(c.title) || c.keywords.some((k) => re.test(k)) || re.test(c.description)
}

/** Ids of the courses that name the skill: a title match first, then free ones, then the rest. */
export function rankCourses<T extends CourseText & { free: boolean }>(courses: T[], skillName: string, limit = 4): T[] {
  const hits = courses.filter((c) => courseNamesSkill(c, skillName))
  const inTitle = (c: T) => (courseNamesSkill({ ...c, description: '', keywords: [] }, skillName) ? 0 : 1)
  return [...hits].sort((a, b) => inTitle(a) - inTitle(b) || Number(b.free) - Number(a.free) || a.title.localeCompare(b.title)).slice(0, limit)
}

/** The 7-character SOC code ("15-1252") of an O*NET-SOC code ("15-1252.00"): what the state training lists use. */
export const soc7 = (soc: string): string => soc.slice(0, 7)

export interface SkillProgram {
  id: string
  state: string
  provider: string
  program: string
  credential: string | null
  costUsd: number | null
  weeks: number | null
  url: string | null
}

/** Up to `limit` programs, one per provider, cheapest first (programs with no stated cost last). */
export function pickPrograms<T extends { id: string; provider: string; costUsd: number | null }>(rows: T[], limit = 6): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of [...rows].sort((a, b) => (a.costUsd ?? Infinity) - (b.costUsd ?? Infinity) || a.provider.localeCompare(b.provider))) {
    if (seen.has(r.provider)) continue
    seen.add(r.provider)
    out.push(r)
    if (out.length >= limit) break
  }
  return out
}
