import 'server-only'
import { prisma } from '@/lib/prisma'
import { AREAS, answersOf, areaOf, type AreaKey, type ReflectionRow } from './areas'

// A member's Find your strengths rows: at most six small rows (one per area), about 2-4 KB in all.
export async function loadReflections(candidateId: string): Promise<ReflectionRow[]> {
  try {
    const rows = await prisma.strengthReflection.findMany({
      where: { candidateId },
      select: { area: true, answers: true, strength: true, proof: true, watchOut: true, sayIt: true, completedAt: true, hiddenFromEmployers: true },
    })
    return rows
      .filter((r) => areaOf(r.area))
      .map((r) => ({
        area: r.area as AreaKey,
        answers: answersOf(r.answers),
        completed: !!r.completedAt,
        hidden: r.hiddenFromEmployers,
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

export interface DossierStrength {
  area: AreaKey
  areaTitle: string
  strength: string
  proof: string
  sayIt: string
}

/**
 * What employers see in the Dossier: each finished area's strength, its proof and the line in the member's words, unless the
 * member hid it. Never the weak spot (watchOut) and never the raw answers. At most six short rows.
 */
export async function loadDossierStrengths(candidateId: string): Promise<DossierStrength[]> {
  try {
    const rows = await prisma.strengthReflection.findMany({
      where: { candidateId, completedAt: { not: null }, strength: { not: null }, hiddenFromEmployers: false },
      select: { area: true, strength: true, proof: true, sayIt: true },
    })
    return AREAS.flatMap((a) => {
      const r = rows.find((x) => x.area === a.key)
      return r?.strength ? [{ area: a.key, areaTitle: a.title, strength: r.strength, proof: r.proof ?? '', sayIt: r.sayIt ?? '' }] : []
    })
  } catch {
    return []
  }
}
