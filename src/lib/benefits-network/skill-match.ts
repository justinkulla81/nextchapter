import 'server-only'
import { prisma } from '@/lib/prisma'
import type { SkillGapSuggestions } from '@/lib/skills/skill-gap-suggestions'

// §A4.3 "tied to the skills gap." Deliberately a plain read of the already-
// cached skillGapSuggestions column, NOT a call to
// getOrGenerateSkillGapSuggestions -- that function does a metered Anthropic
// call on a cache miss, and the Benefits Network catalog page has no reason
// to trigger a fresh generation just to render a match banner. If the
// candidate has never generated suggestions yet (e.g. hasn't visited a page
// that does), this simply returns no tags and the catalog renders with no
// skill-gap match banner -- not an error state.
export async function getCandidateSkillGapTags(candidateId: string): Promise<string[]> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { skillGapSuggestions: true },
  })
  const suggestions = profile?.skillGapSuggestions as unknown as SkillGapSuggestions | null
  if (!suggestions) return []
  return [...(suggestions.resumeGaps ?? []), ...(suggestions.roleGaps ?? []), ...(suggestions.modernSkills ?? [])]
}

// Loose, non-LLM match: a listing's skillGapTags are short alum-authored
// tags (e.g. "FP&A", "Corporate Finance"); a candidate's skill-gap
// suggestions are short LLM-generated tags (e.g. "Financial modeling",
// "SEC 10-K reporting"). Case-insensitive substring match in either
// direction catches the common case ("Corporate Finance" listing tag vs.
// "Corporate Finance certificate" candidate gap) without a second LLM call.
export function findMatchedSkillGap(listingTags: string[], candidateSkillGaps: string[]): string | null {
  for (const tag of listingTags) {
    const normalizedTag = tag.toLowerCase()
    const match = candidateSkillGaps.find((gap) => {
      const normalizedGap = gap.toLowerCase()
      return normalizedGap.includes(normalizedTag) || normalizedTag.includes(normalizedGap)
    })
    if (match) return match
  }
  return null
}
