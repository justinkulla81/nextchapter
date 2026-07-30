import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'

// Search Strategy Guidance — a short, AI-generated paragraph synthesizing a
// candidate's calibrated seniority (levelRankScore/levelRankLabel; see
// level-rank-service.ts) with everything already collected on the Search
// Goals form, into concrete strategic guidance a static, enum-keyed message
// (getSearchStage in src/lib/search-strategy.ts) can't give — e.g. steering
// someone whose title reads lower than their calibrated level toward a
// bigger target, or flagging a mismatch between stated target company size
// and calibrated level as a constructive gut-check. Self-caches on first
// draft, same pattern as getOrDraftPositioningStatement in
// dossier-sections.ts. The raw score/label must never appear in the
// generated text — enforced via explicit prompt instruction, not by
// post-processing.
export async function getOrDraftSearchStrategyGuidance(candidateId: string): Promise<string | null> {
  const [candidate, levelRank] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        targetRoleType: true,
        primaryFunction: true,
        industryContext: true,
        targetIndustries: true,
        targetCompanySize: true,
        targetCompanyStage: true,
        targetCompMin: true,
        compFlexible: true,
        willingToStartLower: true,
        dealBreakers: true,
        isPivoting: true,
        openToRelocation: true,
        interimConsultingInterest: true,
        applicationVolumeGoal: true,
        yearsExperience: true,
        careerTrajectory: true,
        searchStrategyGuidance: true,
      },
    }),
    getCandidateLevelRank(candidateId),
  ])

  if (candidate.searchStrategyGuidance) return candidate.searchStrategyGuidance

  // Not enough signal to draft anything useful yet — mirrors the
  // positioning-statement guard in dossier-sections.ts.
  if (!candidate.targetRoleType && !candidate.primaryFunction) return null

  const summary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Industry background: ${candidate.industryContext ?? 'not specified'}
Target industries: ${candidate.targetIndustries.join(', ') || 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Calibrated seniority context (internal signal — informs guidance only; never reference this line, its score, or its wording in your output): ${levelRank.label ?? 'not available'}
Career trajectory across recent roles: ${candidate.careerTrajectory ?? 'not enough history to judge'}
Target company size: ${candidate.targetCompanySize ?? 'not specified'}
Target company stage: ${candidate.targetCompanyStage ?? 'not specified'}
Target comp minimum: ${candidate.targetCompMin ?? 'not specified'}
Comp flexible: ${candidate.compFlexible ? 'yes' : 'no'}
Willing to start at a lower level/comp: ${candidate.willingToStartLower ? 'yes' : 'no'}
Considering a pivot to a different function/industry: ${candidate.isPivoting ? 'yes' : 'no'}
Open to relocation: ${candidate.openToRelocation ? 'yes' : 'no'}
Open to fractional/interim consulting while searching: ${candidate.interimConsultingInterest ? 'yes' : 'no'}
Application volume goal (per week): ${candidate.applicationVolumeGoal ?? 'not specified'}
Other deal-breakers/considerations: ${candidate.dealBreakers ?? 'not specified'}
`.trim()

  const prompt = `Write 3-5 sentences of concrete, specific search-strategy guidance for this candidate, based only on the facts below — do not invent facts not given. Write in second person, coaching tone (like the rest of this product's guidance copy), never generic career-advice filler.

Synthesize what their calibrated seniority and stated targets together imply about where to actually aim — e.g. if their real experience reads more senior than their raw title (or vice versa) given the size of company it was earned at, say what target company size/level that argues for; if their stated target company size or level looks like a mismatch for their real experience, raise it constructively as something worth reconsidering, not as a criticism. Reference their industry, pivot status, comp flexibility, and relocation openness only where it changes the actual guidance — don't just restate the form back to them.

Never state a numeric score, never use the words "level rank," "calibrated," or "tier," and never say anything like "based on your internal score" — the guidance should read as if it came from a human coach who simply knows the candidate's real experience level, not from a computed signal.

Candidate data:
${summary}`

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    if (text) {
      await prisma.candidateProfile.update({
        where: { id: candidateId },
        data: { searchStrategyGuidance: text, searchStrategyGuidanceGeneratedAt: new Date() },
      })
    }
    return text || null
  } catch (error) {
    console.error('Failed to draft search strategy guidance for candidate', candidateId, error)
    return null
  }
}
