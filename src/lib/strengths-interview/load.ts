import 'server-only'
import { prisma } from '@/lib/prisma'
import { answersOf, areaOf, type AreaKey, type ReflectionRow } from './areas'

// A member's Find your strengths rows: at most six small rows (one per area), about 2-4 KB in all.
export async function loadReflections(candidateId: string): Promise<ReflectionRow[]> {
  try {
    const rows = await prisma.strengthReflection.findMany({
      where: { candidateId },
      select: { area: true, answers: true, strength: true, proof: true, watchOut: true, sayIt: true, completedAt: true },
    })
    return rows
      .filter((r) => areaOf(r.area))
      .map((r) => ({
        area: r.area as AreaKey,
        answers: answersOf(r.answers),
        completed: !!r.completedAt,
        summary: r.strength ? { strength: r.strength, proof: r.proof ?? '', watchOut: r.watchOut, sayIt: r.sayIt ?? '' } : null,
      }))
  } catch (error) {
    console.error('Find your strengths: load failed', error)
    return []
  }
}

/** The finished areas' summaries only, for Why hire me and the pitch. Never includes the raw answers. */
export async function loadReflectionSummaries(candidateId: string): Promise<{ area: AreaKey; strength: string; proof: string; watchOut: string | null; sayIt: string }[]> {
  try {
    const rows = await prisma.strengthReflection.findMany({
      where: { candidateId, completedAt: { not: null }, strength: { not: null } },
      select: { area: true, strength: true, proof: true, watchOut: true, sayIt: true },
    })
    return rows.filter((r) => areaOf(r.area)).map((r) => ({ area: r.area as AreaKey, strength: r.strength!, proof: r.proof ?? '', watchOut: r.watchOut, sayIt: r.sayIt ?? '' }))
  } catch {
    return []
  }
}
