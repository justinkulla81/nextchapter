import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { isSearchGoalsComplete } from '@/lib/search-strategy'

export interface SearchStrategyGuidance {
  pros: string
  cons: string
  suggestedChanges: string
}

export interface SearchStrategyAction {
  label: string
  href: string
}

// Search Strategy Guidance — Victoria's read on a candidate's search
// strategy, synthesizing calibrated seniority (levelRankScore/levelRankLabel;
// see level-rank-service.ts) with everything already collected on the Search
// Goals form into concrete guidance a static, enum-keyed message
// (getSearchStage in src/lib/search-strategy.ts) can't give — e.g. steering
// someone whose title reads lower than their calibrated level toward a
// bigger target, or flagging a mismatch between stated target company size
// and calibrated level as a constructive gut-check. Self-caches on first
// draft (as a JSON blob in the same Text column), same pattern as
// getOrDraftPositioningStatement in dossier-sections.ts, and is nulled by
// updateSearchStrategy on every save so the next page load regenerates
// against the freshly-saved values. The raw score/label must never appear in
// the generated text — enforced via explicit prompt instruction, not by
// post-processing.
export async function getOrDraftSearchStrategyGuidance(candidateId: string): Promise<SearchStrategyGuidance | null> {
  const [candidate, levelRank] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        targetRoleType: true,
        primaryFunction: true,
        secondaryFunction: true,
        industryContext: true,
        targetIndustries: true,
        targetCompanySize: true,
        targetCompanyStage: true,
        remotePreference: true,
        highestLevelReached: true,
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
        gapDuration: true,
        searchStrategyGuidance: true,
        searchStrategyFirstAnsweredAt: true,
      },
    }),
    getCandidateLevelRank(candidateId),
  ])

  const cached = parseCachedGuidance(candidate.searchStrategyGuidance)
  if (cached) return cached

  // Only draft once the full Search Goals section is filled in — a partial
  // form produces guidance that reads confident but is really guessing at
  // the missing fields.
  if (!isSearchGoalsComplete(candidate)) return null

  const summary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Secondary function: ${candidate.secondaryFunction ?? 'not specified'}
Industry background: ${candidate.industryContext ?? 'not specified'}
Target industries: ${candidate.targetIndustries.join(', ') || 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Calibrated seniority context (internal signal — informs guidance only; never reference this line, its score, or its wording in your output): ${levelRank.label ?? 'not available'}
Career trajectory across recent roles: ${candidate.careerTrajectory ?? 'not enough history to judge'}
How long they've been searching: ${candidate.gapDuration ?? 'not specified'}
Target company size: ${candidate.targetCompanySize ?? 'not specified'}
Target company stage: ${candidate.targetCompanyStage ?? 'not specified'}
Target comp minimum: ${candidate.targetCompMin ?? 'not specified'}
Comp flexible: ${candidate.compFlexible ? 'yes' : 'no'}
Willing to start at a lower level/comp: ${candidate.willingToStartLower ? 'yes' : 'no'}
Considering a pivot to a different function/industry: ${candidate.isPivoting ? 'yes' : 'no'}
Open to relocation: ${candidate.openToRelocation ? 'yes' : 'no'}
Open to fractional/interim consulting while searching: ${candidate.interimConsultingInterest ? 'yes' : 'no'}
Application volume goal (per week): ${candidate.applicationVolumeGoal ?? 'not specified'} (we recommend 15/week as a baseline)
Other deal-breakers/considerations: ${candidate.dealBreakers ?? 'not specified'}
`.trim()

  const prompt = `You are Victoria, an executive coach, giving a candidate your honest read on their search strategy, based only on the facts below — do not invent facts not given. Write in second person, coaching tone, never generic career-advice filler.

Return strict JSON with this exact shape, no markdown, no extra keys:
{"pros": "...", "cons": "...", "suggestedChanges": "..."}

- pros: 1-2 sentences on what's genuinely working or well-calibrated about their strategy (e.g. a realistic target given their level, good comp flexibility, a sensible application volume goal). Be specific, not generic praise.
- cons: 1-2 sentences on the real risk or mismatch in their current strategy — e.g. if their real experience reads more senior than their raw title (or vice versa) given the size of company it was earned at, say what that implies; if their stated target company size or level looks like a mismatch for their real experience, raise it constructively as something worth reconsidering, not as a criticism; if their application volume goal is below the 15/week baseline, name that directly (e.g. "too few applications planned this week").
- suggestedChanges: 1-2 sentences of concrete, specific changes to make and why — the single most useful adjustment given everything above. If they've been searching for a while and their trajectory shows a real gap, and they're open to fractional/interim consulting, seriously consider whether the single most useful change is adding that interim/fractional work to their resume and story — it fills the title/experience gap with something concrete rather than a blank stretch, and is often more valuable advice than generic positioning tips.

Never state a numeric score, never use the words "level rank," "calibrated," or "tier," and never say anything like "based on your internal score" — this should read as if it came from a human coach who simply knows the candidate's real experience level, not from a computed signal.

Candidate data:
${summary}`

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Partial<SearchStrategyGuidance>
    if (!parsed.pros || !parsed.cons || !parsed.suggestedChanges) return null

    const guidance: SearchStrategyGuidance = {
      pros: parsed.pros,
      cons: parsed.cons,
      suggestedChanges: parsed.suggestedChanges,
    }

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        searchStrategyGuidance: JSON.stringify(guidance),
        searchStrategyGuidanceGeneratedAt: new Date(),
        // Only ever set, never cleared — see the field's schema comment.
        // updateSearchStrategy nulls searchStrategyGuidance/GeneratedAt on
        // every save so this cache regenerates, but never touches this
        // field, so it survives every future regeneration.
        ...(!candidate.searchStrategyFirstAnsweredAt && { searchStrategyFirstAnsweredAt: new Date() }),
      },
    })
    return guidance
  } catch (error) {
    console.error('Failed to draft search strategy guidance for candidate', candidateId, error)
    return null
  }
}

// Cached rows written before this structured rewrite hold a plain paragraph,
// not JSON — treat those (and any other unparseable value) as no cache, so
// they regenerate once into the new shape rather than rendering garbage.
function parseCachedGuidance(raw: string | null): SearchStrategyGuidance | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SearchStrategyGuidance>
    if (parsed.pros && parsed.cons && parsed.suggestedChanges) {
      return { pros: parsed.pros, cons: parsed.cons, suggestedChanges: parsed.suggestedChanges }
    }
    return null
  } catch {
    return null
  }
}

// Deterministic, app-generated next steps — never LLM-authored, so every
// link is guaranteed to resolve. Lightly personalized off signals already on
// the profile rather than one static evergreen list for everyone.
export function getSearchStrategyActions(candidate: {
  applicationVolumeGoal: number | null
  isPivoting: boolean
  interimConsultingInterest: boolean
}): SearchStrategyAction[] {
  const actions: SearchStrategyAction[] = []

  const weeklyGoal = candidate.applicationVolumeGoal ?? 15
  if (weeklyGoal < 15) {
    actions.push({ label: 'Apply to more jobs this week', href: '/dashboard/find-my-job#apply-new-jobs' })
  } else {
    actions.push({ label: 'Apply to new jobs', href: '/dashboard/find-my-job#apply-new-jobs' })
  }

  if (candidate.isPivoting) {
    actions.push({ label: 'Review roles in your target function', href: '/dashboard/find-my-job#job-recommendations' })
  } else {
    actions.push({ label: 'Review your job recommendations', href: '/dashboard/find-my-job#job-recommendations' })
  }

  actions.push({ label: 'Track companies you want to work for', href: '/dashboard/find-my-job#company-tracker' })

  if (candidate.interimConsultingInterest) {
    actions.push({ label: 'Browse interim & fractional work', href: '/dashboard/interim-work' })
  } else {
    actions.push({ label: 'Sharpen your narrative for interviews', href: '/dashboard/interview-prep' })
  }

  return actions
}
