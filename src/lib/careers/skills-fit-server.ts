import 'server-only'
import { getTaxonomy, getTitleIndex } from '@/lib/careers/taxonomy'
import { resolveCandidateOccupation } from '@/lib/careers/candidate-occupation'
import { skillIdsFromKeywords } from '@/lib/careers/alias-server'
import { matchTitle } from '@/lib/careers/title-match'
import { computeSkillsFit, type SkillsFit } from '@/lib/careers/skills-fit'

/**
 * Sets up skills fit for one person across many jobs: loads their current occupation and the
 * skills their resume evidences once, then answers per job title from memory. No model call.
 * Returns null when the taxonomy is not loaded, in which case the page shows nothing rather
 * than a row of "unavailable".
 *
 * A posting title maps to an occupation only on an exact or clear match against O*NET's titles and
 * alternate titles. Anything else is reported as unmapped, never guessed.
 */
export async function loadSkillsFit(candidateId: string, haveKeywords: string[]): Promise<((jobTitle: string) => SkillsFit) | null> {
  const [taxonomy, index] = await Promise.all([getTaxonomy(), getTitleIndex()])
  if (!taxonomy || !index) return null

  const resolution = await resolveCandidateOccupation(candidateId)
  const source = resolution.status === 'resolved' ? (taxonomy.profiles.get(resolution.socCode) ?? null) : null
  const haveSkillIds = await skillIdsFromKeywords(haveKeywords)

  const cache = new Map<string, SkillsFit>()
  return (jobTitle) => {
    const hit = cache.get(jobTitle)
    if (hit) return hit
    const match = matchTitle(index, jobTitle)
    const target = match.kind === 'EXACT' || match.kind === 'FUZZY' ? (taxonomy.profiles.get(match.socCode) ?? null) : null
    const fit = computeSkillsFit({ source, target, haveKeywords, haveSkillIds })
    cache.set(jobTitle, fit)
    return fit
  }
}
