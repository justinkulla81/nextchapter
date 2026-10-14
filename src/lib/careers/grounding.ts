import type { OccupationProfile } from '@/lib/careers/types'
import { ratedGaps, toolGaps } from '@/lib/careers/vectors'

/**
 * What the target occupation requires that the person's current occupation and
 * their own resume don't already cover, from O*NET. Fed to the skill-gap
 * prompt so suggestions start from a government dataset rather than the
 * model's memory, and used as the fallback list when the model call fails.
 */
export interface SkillGapGrounding {
  sourceSoc: string | null
  targetSoc: string
  targetTitle: string
  /** Concrete tools and technologies, in-demand ones first. */
  tools: string[]
  /** Knowledge areas the target needs at a clearly higher level. */
  knowledge: string[]
  /** Generic O*NET skills the target needs at a clearly higher level (context only; too broad to suggest as-is). */
  skills: string[]
  /** Changes whenever the grounding does, so cached suggestions refresh. */
  key: string
}

export function buildSkillGapGrounding(
  source: OccupationProfile | null,
  target: OccupationProfile,
  haveKeywords: string[]
): SkillGapGrounding {
  const tools = toolGaps(source, target, haveKeywords, 8).map((t) => t.name)
  const rated = source ? ratedGaps(source, target, 12) : []
  const knowledge = rated.filter((g) => g.kind === 'KNOWLEDGE').slice(0, 5).map((g) => g.name)
  const skills = rated.filter((g) => g.kind === 'SKILL').slice(0, 5).map((g) => g.name)
  return {
    sourceSoc: source?.socCode ?? null,
    targetSoc: target.socCode,
    targetTitle: target.title,
    tools,
    knowledge,
    skills,
    key: `${source?.socCode ?? '-'}>${target.socCode}`,
  }
}

export function groundingPromptBlock(g: SkillGapGrounding): string {
  const list = (items: string[]) => (items.length > 0 ? items.join('; ') : 'none identified')
  return `
Verified requirements for the occupation closest to their target role: "${g.targetTitle}" (from O*NET, the US Department of Labor's occupation database), limited to what their current role and resume don't already show:
- Tools and technologies: ${list(g.tools)}
- Knowledge areas needed at a higher level: ${list(g.knowledge)}
- Broad skills needed at a higher level (context only, too general to suggest as written): ${list(g.skills)}

For roleGaps, start from the tools and knowledge areas above rather than your own guesses. Skip any that are generic office software or that don't apply to this candidate's actual target. You may reword a knowledge area into a concrete tag a candidate could evidence.`
}
