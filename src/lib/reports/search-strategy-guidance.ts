import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { isSearchGoalsComplete, isBlockersAndMotivationsComplete } from '@/lib/search-strategy'
import {
  BLOCKER_OPTIONS,
  MOTIVATIONS_OPTIONS,
  COACHING_STYLE_OPTIONS,
  CHANGE_PACE_OPTIONS,
  CHANGE_READINESS_OPTIONS,
} from '@/lib/constants/onboarding'

function labelsFor(options: readonly { value: string; label: string }[], values: string[]) {
  return values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ') || 'not specified'
}

function labelFor(options: readonly { value: string; label: string }[], value: string | null) {
  return (value && options.find((o) => o.value === value)?.label) || 'not specified'
}

const NETWORK_COMFORT_LABEL: Record<string, string> = {
  VERY_COMFORTABLE: 'very comfortable networking',
  SOMEWHAT_COMFORTABLE: 'somewhat comfortable networking',
  NOT_VERY_COMFORTABLE: 'not very comfortable networking',
  RATHER_NOT: 'would rather not network at all',
}

const NETWORKING_ANXIETY_OPTIONS = [
  { value: 'SEEM_DESPERATE', label: "doesn't want to seem desperate" },
  { value: 'BURDEN_PEOPLE', label: "doesn't want to burden people" },
  { value: 'NOT_SURE_WHAT_TO_SAY', label: "isn't sure what to say" },
  { value: 'NETWORK_NOT_STRONG', label: "feels their network isn't strong enough" },
  { value: 'DONT_LIKE_ASKING_FOR_HELP', label: "doesn't like asking for help" },
  { value: 'ALREADY_USED_UP_NETWORK', label: "feels they've already used up their network" },
  { value: 'OTHER', label: 'has another concern' },
] as const

// Real, code-computed behavioral signals — deliberately NOT LLM-inferred,
// so "are they actually doing what their strategy says" is a fact fed
// into the prompt, not a guess. Same shape reused by getSearchStrategyActions
// below so the guidance text and the action list are grounded in the exact
// same numbers, not two independently-derived reads of "how's it going."
export interface SearchStrategyActivitySignals {
  applicationsLast7Days: number
  outreachLast30Days: number
  daysSinceResumeUpload: number | null
}

export async function getSearchStrategyActivitySignals(candidateId: string): Promise<SearchStrategyActivitySignals> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [applicationsLast7Days, outreachLast30Days, latestResume] = await Promise.all([
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: sevenDaysAgo } } }),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: thirtyDaysAgo } } }),
    prisma.resume.findFirst({ where: { candidateId }, orderBy: { uploadedAt: 'desc' }, select: { uploadedAt: true } }),
  ])

  const daysSinceResumeUpload = latestResume
    ? Math.floor((Date.now() - latestResume.uploadedAt.getTime()) / (24 * 60 * 60 * 1000))
    : null

  return { applicationsLast7Days, outreachLast30Days, daysSinceResumeUpload }
}

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
  const [candidate, levelRank, activity] = await Promise.all([
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
        searchStrategyGuidanceGeneratedAt: true,
        searchStrategyFirstAnsweredAt: true,
        blockers: true,
        motivations: true,
        coachingStylePreference: true,
        changePacePreference: true,
        changeReadiness: true,
        networkComfortLevel: true,
        networkingConcerns: true,
      },
    }),
    getCandidateLevelRank(candidateId),
    getSearchStrategyActivitySignals(candidateId),
  ])

  // Re-drafted weekly even without a Search Strategy save, not just cached
  // forever from the first draft — the real-activity numbers below (real
  // applications/outreach/resume recency) change day to day, and a guidance
  // card that never re-syncs with them would defeat the point of feeding
  // them in at all.
  const GUIDANCE_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000
  const cached = parseCachedGuidance(candidate.searchStrategyGuidance)
  const isStale =
    !candidate.searchStrategyGuidanceGeneratedAt ||
    Date.now() - candidate.searchStrategyGuidanceGeneratedAt.getTime() > GUIDANCE_STALE_AFTER_MS
  if (cached && !isStale) return cached

  // Only draft once both required buckets are filled in — Search Goals and
  // Blockers and Motivations — a partial form produces guidance that reads
  // confident but is really guessing at the missing fields.
  if (!isSearchGoalsComplete(candidate) || !isBlockersAndMotivationsComplete(candidate)) return null

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
What's getting in their way: ${labelsFor(BLOCKER_OPTIONS, candidate.blockers)}
What's driving their search: ${labelsFor(MOTIVATIONS_OPTIONS, candidate.motivations)}
Coaching push they respond to: ${labelFor(COACHING_STYLE_OPTIONS, candidate.coachingStylePreference)}
How they like to make progress: ${labelFor(CHANGE_PACE_OPTIONS, candidate.changePacePreference)}
Appetite for a big change right now: ${labelFor(CHANGE_READINESS_OPTIONS, candidate.changeReadiness)}
Self-reported networking comfort: ${candidate.networkComfortLevel ? NETWORK_COMFORT_LABEL[candidate.networkComfortLevel] : 'not specified'}
Specific networking anxieties named: ${candidate.networkingConcerns.length > 0 ? labelsFor(NETWORKING_ANXIETY_OPTIONS, candidate.networkingConcerns) : 'none named'}

REAL activity in the last 7-30 days (ground truth — not self-reported, weigh this over any stated goal or intention above when they conflict):
- Applications actually submitted in the last 7 days: ${activity.applicationsLast7Days} (their own stated weekly goal is ${candidate.applicationVolumeGoal ?? 15})
- Outreach messages actually logged in the last 30 days: ${activity.outreachLast30Days}
- Resume last uploaded/updated: ${activity.daysSinceResumeUpload === null ? 'never uploaded' : `${activity.daysSinceResumeUpload} days ago`}
`.trim()

  const prompt = `You are Victoria, an executive coach, giving a candidate your honest read on their search strategy, based only on the facts below — do not invent facts not given. Write in second person, coaching tone, never generic career-advice filler.

Return strict JSON with this exact shape, no markdown, no extra keys:
{"pros": "...", "cons": "...", "suggestedChanges": "..."}

- pros: 1-2 sentences on what's genuinely working or well-calibrated about their strategy (e.g. a realistic target given their level, good comp flexibility, a sensible application volume goal — or, if their REAL activity matches or beats their stated goal, that's real and worth naming specifically, e.g. "you're actually averaging above your own 15/week goal"). Be specific, not generic praise, and prefer real activity over stated intentions when both point the same direction.
- cons: 1-2 sentences on the real risk or mismatch in their current strategy. Weigh these, in rough priority order: (a) a gap between REAL activity and their own stated goal/blocker — e.g. their goal is 15/week but they've actually submitted far fewer in the last 7 days, or they named networking discomfort as a blocker and have logged zero outreach in 30 days (name this plainly: stating a comfort level isn't the same as never acting on it, and it's fine to say so); (b) if their real experience reads more senior than their raw title (or vice versa) given the size of company it was earned at, say what that implies; (c) if their stated target company size or level looks like a mismatch for their real experience, raise it constructively as something worth reconsidering; (d) if the resume hasn't been touched in a long time relative to how long they've been searching, that's worth naming too — a stale resume against a live search is itself a mismatch.
- suggestedChanges: 1-2 sentences of concrete, specific changes to make and why — the single most useful adjustment given everything above, prioritizing whichever real-vs-stated gap from "cons" is most actionable this week. If the real gap is networking (stated discomfort + near-zero real outreach), the single most useful change is often a very small, concrete first action (e.g. "one message to one person this week"), not a strategy overhaul. If they've been searching for a while and their trajectory shows a real gap, and they're open to fractional/interim consulting, seriously consider whether the single most useful change is adding that interim/fractional work to their resume and story — it fills the title/experience gap with something concrete rather than a blank stretch. If the resume is stale relative to the search, say to update it before anything else — advice grounded in a resume the reader is about to see stale/outdated undercuts everything else.

Calibrate your tone to the coaching push and pace they said works for them (tough love vs. gentle, baby steps vs. big leaps) — never mention that you're doing this, just write in that register. If a blocker they named (e.g. financial pressure, networking discomfort, not knowing what's next) plausibly explains a gap between their stated strategy and their real activity, it's fine to name that gap directly and matter-of-factly, in the tone they asked for — never softened into vague euphemism, but never clinical or diagnostic either.

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
// link is guaranteed to resolve. Grounded in the SAME real activity signals
// (SearchStrategyActivitySignals) the guidance text above is built from —
// not just stated preferences — so "Specific actions to take" actually
// tracks what the guidance just said, instead of two independently-derived
// reads of the same candidate.
export function getSearchStrategyActions(
  candidate: {
    applicationVolumeGoal: number | null
    isPivoting: boolean
    interimConsultingInterest: boolean
    blockers: string[]
  },
  activity: SearchStrategyActivitySignals
): SearchStrategyAction[] {
  const actions: SearchStrategyAction[] = []
  const weeklyGoal = candidate.applicationVolumeGoal ?? 15

  // Real activity this week beats the stated goal, not the other way
  // around — a candidate who set a low goal but is actually applying a lot
  // shouldn't see "apply more" as their top action.
  if (activity.applicationsLast7Days < weeklyGoal) {
    actions.push({ label: 'Apply to more jobs this week', href: '/dashboard/find-my-job#apply-new-jobs' })
  } else {
    actions.push({ label: 'Apply to new jobs', href: '/dashboard/find-my-job#apply-new-jobs' })
  }

  // Resume staleness is worth surfacing before anything else search-facing
  // — advice grounded in an out-of-date resume undercuts the rest.
  if (activity.daysSinceResumeUpload === null || activity.daysSinceResumeUpload > 60) {
    actions.push({ label: 'Update your resume', href: '/dashboard/resume' })
  }

  // The exact "stated a networking blocker but isn't actually networking"
  // gap the guidance text now names directly — the action list should
  // offer the smallest real next step for it, not a generic link.
  if (candidate.blockers.includes('networking_discomfort') && activity.outreachLast30Days === 0) {
    actions.push({ label: 'Send your first outreach message', href: '/dashboard/network#scripts' })
  }

  if (candidate.isPivoting) {
    actions.push({ label: 'Review roles in your target function', href: '/dashboard/find-my-job#job-recommendations' })
  } else {
    actions.push({ label: 'Review your job recommendations', href: '/dashboard/find-my-job#job-recommendations' })
  }

  if (candidate.interimConsultingInterest) {
    actions.push({ label: 'Browse interim & fractional work', href: '/dashboard/interim-work' })
  }

  actions.push({ label: 'Track companies you want to work for', href: '/dashboard/find-my-job#company-tracker' })

  if (!candidate.interimConsultingInterest) {
    actions.push({ label: 'Sharpen your narrative for interviews', href: '/dashboard/interview-prep' })
  }

  // Cap at 5 — the point is "what to do next," not an exhaustive checklist;
  // earlier-pushed items (real-activity-driven) always win the cut.
  return actions.slice(0, 5)
}
