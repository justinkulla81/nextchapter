import 'server-only'
import { prisma } from '@/lib/prisma'

export interface MatchedCourse {
  id: string
  title: string
  sponsor: string | null
  url: string
  free: boolean
  /** Names of the gap skills this course covers, for "covers X, Y". */
  covers: string[]
}

/**
 * Active catalog courses tagged with any of the given taxonomy skills, the ones
 * covering the most gaps first. Returns [] if the tag table is missing or empty.
 */
export async function coursesForSkills(skillIds: string[], limit = 3): Promise<MatchedCourse[]> {
  if (skillIds.length === 0) return []
  try {
    const rows = await prisma.courseSkill.findMany({
      where: { skillId: { in: skillIds }, course: { isActive: true } },
      select: { skill: { select: { name: true } }, course: { select: { id: true, title: true, sponsor: true, url: true, free: true } } },
    })
    const byCourse = new Map<string, MatchedCourse>()
    for (const r of rows) {
      const entry = byCourse.get(r.course.id) ?? { ...r.course, covers: [] }
      entry.covers.push(r.skill.name)
      byCourse.set(r.course.id, entry)
    }
    return [...byCourse.values()]
      .sort((a, b) => b.covers.length - a.covers.length || Number(b.free) - Number(a.free) || a.title.localeCompare(b.title))
      .slice(0, limit)
  } catch (error) {
    console.error('Course matching unavailable:', error)
    return []
  }
}

export interface MatchedProgram {
  id: string
  providerName: string
  programName: string
  url: string | null
  credential: string | null
  deliveryMode: string | null
  costUsd: number | null
  durationWeeks: number | null
  sourceName: string
}

/**
 * Publicly funded programs in the person's state that prepare for the occupation,
 * matched on the 6-digit SOC code. Empty when that state's list has not been loaded.
 */
export async function programsForOccupation(socCode: string, state: string | null, limit = 3): Promise<MatchedProgram[]> {
  if (!state || state.length !== 2) return []
  try {
    return await prisma.trainingProgram.findMany({
      where: { state: state.toUpperCase(), socCodes: { has: socCode.slice(0, 7) } },
      orderBy: [{ costUsd: { sort: 'asc', nulls: 'last' } }, { programName: 'asc' }],
      take: limit,
      select: { id: true, providerName: true, programName: true, url: true, credential: true, deliveryMode: true, costUsd: true, durationWeeks: true, sourceName: true },
    })
  } catch (error) {
    console.error('Training program lookup unavailable:', error)
    return []
  }
}
