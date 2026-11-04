import 'server-only'
import { prisma } from '@/lib/prisma'
import { pickPrograms, rankCourses, soc7, type CourseText, type SkillCourse, type SkillProgram } from '@/lib/skills/learn'

const TTL_MS = 30 * 60_000
type ActiveCourse = CourseText & { title: string; sponsor: string | null; provider: string; url: string; free: boolean; skillLevel: string }
let held: { at: number; rows: Promise<ActiveCourse[]> } | null = null

/** The active course list, held per server instance for 30 minutes (about a hundred rows; every skill page filters the same list). */
function activeCourses(now = Date.now()): Promise<ActiveCourse[]> {
  if (held && now - held.at < TTL_MS) return held.rows
  const rows = prisma.course
    .findMany({ where: { isActive: true }, select: { id: true, title: true, description: true, keywords: true, sponsor: true, provider: true, url: true, free: true, skillLevel: true } })
    .then((r) => r.map((c) => ({ ...c, skillLevel: String(c.skillLevel) })))
    .catch(() => [] as ActiveCourse[])
  held = { at: now, rows }
  return rows
}

export async function coursesForSkill(skillName: string, limit = 4): Promise<SkillCourse[]> {
  return rankCourses(await activeCourses(), skillName, limit).map((c) => ({ id: c.id, title: c.title, sponsor: c.sponsor, provider: c.provider, url: c.url, free: c.free, level: c.skillLevel.toLowerCase() }))
}

/** State-approved (WIOA) training programs that prepare for these occupations. A failed read just leaves the list out. */
export async function programsForJobs(socs: string[], limit = 6): Promise<SkillProgram[]> {
  const codes = [...new Set(socs.map(soc7))]
  if (codes.length === 0) return []
  const rows = await prisma.trainingProgram
    .findMany({ where: { socCodes: { hasSome: codes } }, take: 60, select: { id: true, state: true, providerName: true, programName: true, credential: true, costUsd: true, durationWeeks: true, url: true } })
    .catch(() => [])
  return pickPrograms(rows.map((r) => ({ id: r.id, state: r.state, provider: r.providerName, program: r.programName, credential: r.credential, costUsd: r.costUsd, weeks: r.durationWeeks, url: r.url })), limit)
}
