import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export interface SkillGapSuggestions {
  // Skills a candidate at this level/function typically has that this
  // resume doesn't evidence — the actual gap, not a random skill list.
  resumeGaps: string[]
  // Skills specifically expected for the target role/industry that aren't
  // already covered by resumeGaps.
  roleGaps: string[]
  // Contemporary skills (AI/GenAI tools, modern workflow platforms) worth
  // having regardless of target role — kept separate so a candidate who
  // already has strong AI fluency doesn't see it buried in generic gaps.
  modernSkills: string[]
}

const suggestionsSchema = z.object({
  resumeGaps: z.array(z.string()).max(6),
  roleGaps: z.array(z.string()).max(6),
  modernSkills: z.array(z.string()).max(6),
})

interface SkillGapProfile {
  id: string
  resumeKeywords: string[]
  primaryFunction: string | null
  targetRoleType: string | null
  targetIndustries: string[]
  aiFlexibilityLevel: number | null
  skillsToBuild: string[]
  skillGapSuggestions: unknown
  skillGapSuggestionsFingerprint: string | null
}

// Cheap equality check on the handful of fields that should actually
// invalidate a cached suggestion set — a resume re-upload, a changed
// target role, or new target industries. Order-independent so re-saving
// the same tags/industries in a different order doesn't trigger a
// pointless (metered) regeneration.
function computeFingerprint(profile: SkillGapProfile): string {
  return [
    [...profile.resumeKeywords].sort().join('|'),
    profile.primaryFunction ?? '',
    profile.targetRoleType ?? '',
    [...profile.targetIndustries].sort().join('|'),
    String(profile.aiFlexibilityLevel ?? ''),
  ].join('::')
}

async function generateViaLLM(profile: SkillGapProfile): Promise<SkillGapSuggestions | null> {
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 800,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(suggestionsSchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `A job candidate is deciding what skills to build next. Suggest short, specific skill tags (2-4 words each, e.g. "Financial modeling", "GenAI prompt engineering", "Salesforce admin") across three categories. Never suggest anything already listed in "skills their resume already shows" or "skills they've already picked to build" below — those are covered.

Current/most recent function: ${profile.primaryFunction ?? 'unknown'}
Target role: ${profile.targetRoleType ?? 'unspecified'}
Target industries: ${profile.targetIndustries.length > 0 ? profile.targetIndustries.join(', ') : 'unspecified'}
Skills their resume already shows: ${profile.resumeKeywords.length > 0 ? profile.resumeKeywords.join(', ') : 'none extracted'}
Skills they've already picked to build: ${profile.skillsToBuild.length > 0 ? profile.skillsToBuild.join(', ') : 'none yet'}

Return three lists, up to 6 items each:
- resumeGaps: skills someone at this candidate's level/function typically has that their resume doesn't show
- roleGaps: skills specifically expected for their stated target role/industry, not already covered by resumeGaps
- modernSkills: contemporary AI/GenAI or modern-workflow skills worth having for their function, regardless of target role

If a category has nothing genuinely useful to add, return fewer items rather than padding it.`,
        },
      ],
    })
    const message = await stream.finalMessage()
    return message.parsed_output ?? null
  } catch (error) {
    console.error('Failed to generate skill gap suggestions for', profile.id, error)
    return null
  }
}

// Real per-candidate LLM cost — only called when the cached suggestions are
// missing or stale (see computeFingerprint), never on every page view.
export async function getOrGenerateSkillGapSuggestions(candidateId: string): Promise<SkillGapSuggestions | null> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: {
      id: true,
      resumeKeywords: true,
      primaryFunction: true,
      targetRoleType: true,
      targetIndustries: true,
      aiFlexibilityLevel: true,
      skillsToBuild: true,
      skillGapSuggestions: true,
      skillGapSuggestionsFingerprint: true,
    },
  })

  const fingerprint = computeFingerprint(profile)
  if (profile.skillGapSuggestions && profile.skillGapSuggestionsFingerprint === fingerprint) {
    return profile.skillGapSuggestions as unknown as SkillGapSuggestions
  }

  const generated = await generateViaLLM(profile)
  if (!generated) return null

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      skillGapSuggestions: generated as unknown as object,
      skillGapSuggestionsFingerprint: fingerprint,
    },
  })

  return generated
}
