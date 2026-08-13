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
  // Self-identified strengths/growth areas (Skills Inventory assessment) —
  // real, accuracy-improving signal: strengths are excluded from
  // suggestions the same way skillsToBuild is, and growth areas are a
  // genuine lead for what's actually worth suggesting. Deliberately NOT
  // pulling in the Working Style / How I Perform behavioral assessments —
  // those measure how a candidate operates (pace, collaboration style,
  // decision-making), not what concrete, demonstrable skills they have or
  // need, and folding them in was the likely source of vague, personality-
  // flavored suggestions like "Cross-functional team leadership."
  topStrengths: string[]
  growthAreas: string[]
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
    [...profile.topStrengths].sort().join('|'),
    [...profile.growthAreas].sort().join('|'),
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
          content: `A job candidate is deciding what skills to build next. Suggest short, specific skill tags (2-4 words each, e.g. "Financial modeling", "GenAI prompt engineering", "Salesforce admin", "SEC 10-K reporting") across three categories. Never suggest anything already listed in "skills their resume already shows" or "skills they've already picked to build" below — those are covered.

Accuracy matters far more than quantity here. Every suggestion must be:
- A real, concrete, demonstrable skill, tool, technique, or credential — something a candidate could show evidence of (a project, a certification, a specific output) — not a trait, a soft-skill label, or a management platitude.
- Genuinely tied to the jobs this candidate is actually targeting (their stated function/target role/industries below), not a generic "good to have for any executive" filler item.
- Never a vague competency phrase like "Cross-functional team leadership," "Strategic thinking," "Stakeholder management," or "Executive presence" — if the real underlying gap is something like that, name the concrete skill or credential that would actually demonstrate it instead (e.g. not "Team leadership" but "P&L ownership for a 20+ person team" only if that's a real, checkable gap — otherwise omit it).

Current/most recent function: ${profile.primaryFunction ?? 'unknown'}
Target role: ${profile.targetRoleType ?? 'unspecified'}
Target industries: ${profile.targetIndustries.length > 0 ? profile.targetIndustries.join(', ') : 'unspecified'}
Skills their resume already shows: ${profile.resumeKeywords.length > 0 ? profile.resumeKeywords.join(', ') : 'none extracted'}
Skills they've already picked to build: ${profile.skillsToBuild.length > 0 ? profile.skillsToBuild.join(', ') : 'none yet'}
Self-identified strengths (already strong — don't suggest these): ${profile.topStrengths.length > 0 ? profile.topStrengths.join(', ') : 'none specified'}
Self-identified growth areas (a real signal for what's worth suggesting, but only if it translates to a concrete skill/tool/credential — not a personality trait): ${profile.growthAreas.length > 0 ? profile.growthAreas.join(', ') : 'none specified'}

Return three lists, up to 6 items each:
- resumeGaps: skills someone at this candidate's level/function typically has that their resume doesn't show
- roleGaps: skills specifically expected for their stated target role/industry, not already covered by resumeGaps
- modernSkills: contemporary AI/GenAI or modern-workflow skills worth having for their function, regardless of target role

If a category has nothing genuinely useful and concrete to add, return fewer items rather than padding it — an empty category is a better answer than a fluffy one.`,
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
      topStrengths: true,
      growthAreas: true,
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
