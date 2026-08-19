// Generates the CANDIDATE-facing Market Reality Report — strengths/weaknesses,
// a 7-day action plan, and gap analysis with remediation paths, built from
// everything collected elsewhere (assessment, references, interviews, work
// history, resume analysis, job-fit feedback).
//
// Distinct from src/lib/reports/hiring-manager-report.ts (employer-facing,
// hides raw scores/jargon). This one shows everything to the candidate about
// themselves — no hiding.

import 'server-only'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import type { ResumeFeedbackItem } from '@/lib/resume/analyze-resume'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { translateDimensionVectors, type DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { translateWorkStyleVectors } from '@/lib/scoring/work-style-vectors'
import { getMarketConditions } from '@/lib/market'
import { searchAdzunaJobs } from '@/lib/market/adzuna'
import { generateJobPattern, MIN_SIGNALS_FOR_PATTERN } from '@/lib/network/job-discovery'
import { computeApplicationTrends } from '@/lib/network/application-trends'
import { computeNamedReasons } from '@/lib/scoring/named-reasons'
import { getNamedReasonActionLink } from '@/lib/scoring/named-reason-ids'
import { captureServerEvent } from '@/lib/posthog/server'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { BIGGEST_BARRIER_OPTIONS, TOP_STRENGTH_OPTIONS, TRADEOFF_PRIORITIES } from '@/lib/constants/onboarding'
import { computeDirectnessLevel, DIRECTNESS_INSTRUCTION } from '@/lib/scoring/directness-level'
import { getMondayOfWeek, getCandidateWeekNumber } from '@/lib/weekly/sprint'
import { computeWeeksOfImprovement } from '@/lib/scoring/market-reality-history'
import {
  CURRENT_JOB_STATUS_LABELS,
  isVagueTargetRole,
  detectManagementGoalConflict,
} from '@/lib/constants/onboarding'
import { computeMarketRealityComponents } from '@/lib/scoring/market-reality/compute'
import { computeMarketRealityCompositeGrade } from '@/lib/scoring/market-reality/composite'
import { buildMarketRealityHeadline } from '@/lib/scoring/market-reality/narrative'
import type { DimensionKey, Finding } from '@/lib/scoring/resume-analysis/types'

export const actionPlanItemTypes = [
  'NETWORKING_LIST',
  'OUTREACH_MESSAGE',
  'LINKEDIN_SETUP',
  'LINKEDIN_POST_IDEA',
  'INTERVIEW_PREP',
  'NEGOTIATION_ADVICE',
  'PROFILE_CONFIRM',
  'INDUSTRY_CONFIRM',
  'FUNCTION_CONFIRM',
  'SALARY_CONFIRM',
  'WORK_AUTHORIZATION',
] as const

const marketRealityReportSchema = z.object({
  // Cap tightened 6->5 (Report Structure Spec §3.2: "Three to five items") —
  // this field is now also read directly as the new report's "What's
  // working" section (market-reality/page.tsx), not just the old report body.
  strengths: z.array(z.object({ title: z.string(), detail: z.string() })).min(3).max(5),
  weaknesses: z.array(z.object({ title: z.string(), detail: z.string() })).min(2).max(5),
  // Report Structure Spec §3.3: "Show the rewrite, not just the
  // instruction." `before` must be copied verbatim from one of the quoted
  // weak bullets supplied in the prompt below — anything else is dropped at
  // render time (market-reality-sections.ts's self-check against the real
  // ResumeAnalysis finding). Empty array when no weak bullet was supplied.
  resumeRewrites: z.array(z.object({ before: z.string(), after: z.string() })).max(3),
  hillToClimb: z.object({
    tone: z.enum(['very_positive', 'positive_with_work', 'significant_climb']),
    narrative: z.array(z.string()).min(2).max(5),
  }),
  // Widened beyond exactly-7-days-numbered-1-7: the model occasionally emits
  // an extra day or an off-range day number while satisfying every "HARD
  // REQUIREMENT" item above, which used to hard-fail the whole report with
  // this schema at .length(7)/min(1).max(7). normalizeActionPlan() below
  // trims/renumbers whatever comes back into a clean 7-day plan instead.
  actionPlan: z
    .array(
      z.object({
        day: z.number().int().min(0).max(14),
        items: z.array(
          z.object({
            text: z.string(),
            actionType: z.enum(actionPlanItemTypes).optional(),
          })
        ),
      })
    )
    .min(7)
    .max(10),
  gapAnalysis: z.object({
    targetRole: z.string(),
    gaps: z.array(
      z.object({
        area: z.string(),
        why: z.string(),
        remediation: z.string(),
        remediationType: z.enum(['upskilling', 'fractional_contract', 'consulting', 'networking', 'other']),
      })
    ),
  }),
  marketConditions: z
    .object({
      narrative: z.array(z.string()).min(1).max(4),
    })
    .nullable(),
  executiveSummary: z.object({
    improvementNarrative: z.array(z.string()).min(1).max(4),
    whatToDoMore: z.array(z.string()).min(1).max(4),
  }),
})

type RawActionPlan = z.infer<typeof marketRealityReportSchema>['actionPlan']

// The model is asked for exactly 7 days but occasionally overshoots (an
// extra day, or a day numbered outside 1-7) while satisfying all the "HARD
// REQUIREMENT" items in the prompt above. Each entry's own items stay
// grouped together (they were written to make sense as a set) — this just
// keeps the first 7 entries in order and renumbers them 1-7, rather than
// rejecting the whole report over a cosmetic day-count/day-number slip.
function normalizeActionPlan(actionPlan: RawActionPlan): RawActionPlan {
  return actionPlan.slice(0, 7).map((day, i) => ({ ...day, day: i + 1 }))
}

// Resume.atsFeedback/resultsFeedback/experienceFeedback are stored as
// Json[] of { issue, action } (see analyze-resume.ts) — flatten each pair
// into one line for this plain-text prompt context.
function joinResumeFeedback(feedback: Prisma.JsonValue[]): string {
  return (feedback as unknown as ResumeFeedbackItem[]).map((f) => `${f.issue} (Fix: ${f.action})`).join('; ')
}

const PROMPT_PREFIX = `${VICTORIA_VOICE_PROMPT}

You are writing this Market Reality Report as Victoria, directly for the candidate — not for an employer, so show everything, no hedging or hiding of self-report contradictions. This report is built around one named grade, the Market Reality Grade (A-F) — a day-one read on their resume and real work experience, capped by how many similar roles actually exist in the market. It does NOT reflect references, networking, or other ongoing platform activity — that builds a separate thing, their Dossier, over time, and is out of scope for this report. Reference the grade by name where relevant instead of a single generic "score."

HARD REQUIREMENT — no raw numbers, anywhere: never cite a raw numeric score (e.g. "88/100", "a 62") in any written field. Numbers below are for your own reasoning only. When referencing standing, use only the letter grade (A-F) or its label (Excellent/Good/Average/Needs work/Critical gap) — never a number.

HARD REQUIREMENT — never include "commit to your first Search Sprint," "start your Search Sprint," build your network, or any other ongoing-effort/Dossier-building framing as one of the 7 action-plan day items — this report's action plan is scoped to job goals, resume, and personalization only. Those other actions live in the Dossier instead (see the Portfolio page), not here.

HARD REQUIREMENT — never say anything that ranks employers or schools against each other, never state or imply a probability of being hired, never imply that a gap, a short tenure, or a career break is a character issue, and never use consolation framing ("unfortunately," "sadly," or similar) — state the situation and the path forward instead.

Underlying theme to weave in naturally (don't force it into every section, but it must appear at least once, ideally in the hill-to-climb narrative or the action plan intro): not everyone who searches will land the role they want — that's the honest truth, never promise an outcome — but doing the real work on their resume, positioning, and search fundamentals meaningfully improves their odds. This grade reflects what's true today, not effort — never imply the 7-day action plan itself raises this specific grade; it becomes a fuller picture of the candidate once they build out their Dossier (references, network, verified work) elsewhere on the platform.

Write:
1. Strengths (3-5): specific, evidenced by their actual data below, not generic praise. For a low-band candidate this section must still be short but never empty — find the real floor and name it (a real team size actually managed, a real process improvement, a real completed reference) rather than manufacturing praise or skipping the section.
2. Weaknesses (2-5): an "accountability mirror," not a resume nitpick list — candidly name the ways this candidate could realistically fail or stall in a real search (self-report contradictions, low job-search intensity, unrealistic target vs. actual experience, real resume presentation gaps), evidenced by their actual data below. Be direct, not harsh. If "Target role" is flagged as vague/no clear direction below, combine that with their other motivation signals (job search intensity, tradeoff rankings, flexibility preferences) to name whether they seem to genuinely lack direction or just haven't written it down yet — don't treat vagueness alone as damning.
   - HARD REQUIREMENT: every weakness's "detail" must end with one concrete, specific instruction on exactly what to do about it — name the real page and the real field(s) to fill in or fix (e.g. "Fill this in on your Search Strategy page: target function, what you're known for, deal-breakers, and how you'd rank tradeoffs.") or the exact resume change needed. A diagnosis with no named next step is incomplete — the candidate reading this must know precisely where to click and what to enter, not just what's wrong.
   - HARD REQUIREMENT: if "Management/IC preference vs. goals conflict" below is YES, name this tension as one of the weaknesses (or fold it into the gap analysis). Trust that they genuinely want to be an individual contributor — never suggest they secretly want to manage — but be direct that their team-management history and/or their stated target role point toward a more senior/managerial track, and they'll need to either retarget their search toward true IC-track roles (which may mean a different title or level than they wrote down) or consciously plan for the trade-off a more senior title actually requires (less hands-on work, more people management, even if that's not their preference).
   - HARD REQUIREMENT: if "Considering a pivot to a different function/industry" below is YES, straight talk is non-negotiable — do not soften or omit this: pivoting is genuinely harder than a lateral search. Name at least one concrete reason why in the weaknesses or hill-to-climb narrative — a longer realistic timeline, the extra work of translating past achievements into the target function/industry's language (on the resume, in interviews, in networking conversations), and a heavier dependence on warm introductions and networking since keyword-matched job boards won't surface an unconventional background. Never frame the pivot itself as a mistake or discourage it — only be honest about the work it requires.
3. Hill to climb: one honest, holistic evaluation of how hard finding a job will realistically be for this candidate, given everything below (their Market Reality Grade, experience, market conditions, job search intensity, self-awareness signals, resume completeness). Choose a "tone" — "very_positive" for strong candidates who are doing the right things, "positive_with_work" for solid candidates with real gaps, "significant_climb" for candidates facing a genuinely hard market position — and write 2-5 narrative sentences that are honest about the difficulty but never discouraging: always end on what real work on their resume, positioning, and target does to improve their odds. Never imply the grade guarantees an outcome.
   - HARD REQUIREMENT: if "Considering a pivot to a different function/industry" below is YES, the tone and narrative must reflect that pivoting is a harder path than a lateral move (see the weaknesses instruction above) — never pick "very_positive" on the strength of a lateral candidate's profile alone if they're pivoting. Still end on what's in their control: the transferable-skills story they build, the networking they do, and the specificity of the target they pick all move the needle even on a pivot.
4. An action plan (exactly 7 days, each with concrete items). Each item has a "text" field and an optional "actionType" tag. Where relevant, reference real features of this platform: joining the Community Board (posting a job/project/intro or expressing interest in one), requesting a reference, uploading a work sample, adding a job posting for fit feedback.
   - HARD REQUIREMENT: write every item's "text" in this exact shape: a short action name (3-6 words, no reasoning in it) + " — " + one short clause on why it matters, in plain language a candidate would find compelling. Example: "Confirm your industry — recruiters match you on this first." The UI hyperlinks only the part before the dash, so the action name must stand alone as something clickable; never put the reason before the dash or omit the dash.
   - After satisfying every HARD REQUIREMENT item below, fill any remaining day slots with items that make progress on "Currently open gaps" (see candidate data below) rather than generic advice — when a gap lists an existing platform resource, point the candidate at it by name instead of re-deriving generic advice unrelated to any open gap.
   - HARD REQUIREMENT: if "Resume on file" below says "no", one of the 7 days MUST include uploading a resume, and must explain that it meaningfully improves their score and lets this report generate specific, evidence-based resume suggestions. If "Resume on file" says "yes", one of the 7 days MUST instead include applying this report's/the resume analysis's suggestions to improve it. Never do both, never do neither.
   - HARD REQUIREMENT: if "LinkedIn status confirmed" below says "no", one of the 7 days MUST include confirming whether they have a LinkedIn URL or don't have one yet, tagged actionType "LINKEDIN_SETUP". If "LinkedIn status confirmed" says "yes" but "LinkedIn URL on file" says "no", one of the 7 days MUST include actually creating a LinkedIn profile, tagged actionType "LINKEDIN_SETUP", explaining briefly why having one is critical to a modern job search (visibility to recruiters, network effects). If both say "yes", do NOT include this item — active LinkedIn use (posting, being active) lives in the Dossier's action list, not here.
   - If any job posting has landed an interview (see "Interview landed" below), mention it and point them to this platform's own generated interview prep for that job, tagged actionType "INTERVIEW_PREP", rather than re-deriving interview advice yourself.
   - If any job posting has an offer (see "Offer received" below), mention it and point them to this platform's own generated negotiation advice for that job, tagged actionType "NEGOTIATION_ADVICE", rather than re-deriving negotiation advice yourself.
   - HARD REQUIREMENT: if "Profile confirmed" below says "no", one of the 7 days MUST include confirming their name/contact/address details (auto-filled from their resume, may need correction), tagged actionType "PROFILE_CONFIRM". If "yes", do NOT include this item.
   - HARD REQUIREMENT: if "Industry confirmed" below says "no", one of the 7 days MUST include confirming their industry (auto-filled from their resume), tagged actionType "INDUSTRY_CONFIRM". If "yes", do NOT include this item.
   - HARD REQUIREMENT: if "Function/title/years confirmed" below says "no", one of the 7 days MUST include confirming their primary function, latest job title, and years of experience (auto-filled from their resume), tagged actionType "FUNCTION_CONFIRM". If "yes", do NOT include this item.
   - HARD REQUIREMENT: if "Salary/work authorization confirmed" below says "no", one of the 7 days MUST include answering their last salary and work authorization status (these are not on their resume), tagged actionType "SALARY_CONFIRM" for one item and actionType "WORK_AUTHORIZATION" for a separate item. If "yes", do NOT include either item.
5. Gap analysis: identify gaps against their stated target role, and suggest a remediation path for each — upskilling, fractional/contract work (you may name real categories like "fractional/contract platforms such as Mercor or Toptal" without fabricating specific URLs), consulting, or networking.
   - HARD REQUIREMENT: if "Considering a pivot to a different function/industry" below is YES, weight networking and story-building remediation (translating prior achievements into the target function/industry's language, warm introductions into that space) more heavily than generic upskilling — keyword-matched job boards are the least effective channel for an unconventional background, and the gaps/remediation should reflect that honestly.
   - If "Location preference" below is "remote", include one honest, non-judgmental note somewhere in the strengths/weaknesses/hill-to-climb sections acknowledging that on-site presence is genuinely a plus for many employers, that remote work matters a great deal to many people too, that there are real benefits to in-person work (mentorship, visibility, spontaneous collaboration), and that they might consider hybrid as a middle ground worth weighing — framed as an option to consider, never as pressure to abandon a real preference.
6. Market conditions: if "Market data available" below is "yes", write 1-4 short bullet points of honest commentary on local job availability and occupational trend using ONLY the facts provided — never invent a number that isn't given. Weave in "Openings matching their exact target title" and "Openings matching their target function + industry" below wherever they say a real count (skip either one entirely if it says "not available" — do not mention a number for it or explain why it's missing). End with one direct sentence connecting these facts to how hard their search will realistically be — this should agree with, not contradict, the hill-to-climb tone above. If "Market data available" is "no", set marketConditions to null rather than speculating or estimating.
7. Executive Summary (this appears at the very top of the report, before the grades — write it so it stands alone): two parts, each 1-4 sentences.
   - improvementNarrative: see "Report-over-report change" below.
     - HARD REQUIREMENT: if "Is this the candidate's first-ever report" is "yes", there is nothing to compare against — say so plainly and frame this as their baseline ("this is where you stand today"), never claim improvement or decline.
     - Otherwise, credit them SPECIFICALLY by name for any real new data they added since their last report (e.g. "an updated resume," "your work-style assessment") — never a vague "you've been active." Connect it to what it actually did ONLY if the grade movement data below supports that connection — never invent a causal link the data doesn't support. If nothing new was added and nothing moved, say so plainly and honestly rather than manufacturing false credit — that's a real, useful signal too (nudge toward action, don't scold).
   - whatToDoMore: the single highest-leverage thing(s) they should do more of right now on their resume, positioning, or target — grounded in "Currently open gaps" above, concrete and specific, not generic advice.
8. Resume rewrites (0-3): "Weak bullets to rewrite" below lists up to 3 real, verbatim-quoted bullets already flagged by the resume scoring engine as weak. For EACH one supplied, write a rewritten version that keeps every real fact (no invented numbers, no invented outcomes) but leads with the result and states it as a from/to change wherever the original implies one. Copy the "before" field VERBATIM, character-for-character, from the supplied quote — it's matched back to the original finding by exact text, so a paraphrased "before" will silently discard the rewrite. If no weak bullets are supplied below, return an empty array — never invent a bullet to rewrite.

Candidate data:
`

export async function generateMarketRealityReport(candidateId: string): Promise<void> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      assessmentResponses: { orderBy: { completedAt: 'desc' }, take: 1 },
      performanceAssessmentResponses: { orderBy: { completedAt: 'desc' }, take: 1 },
      workHistory: true,
      references: { where: { status: 'COMPLETED' } },
      resumes: { orderBy: { uploadedAt: 'desc' }, take: 1 },
      jobPostings: {
        where: {
          OR: [{ fitScore: { not: null } }, { interviewLandedAt: { not: null } }, { offerReceivedAt: { not: null } }],
        },
      },
      linkedInActivityLogs: true,
      workSamples: true,
      communityPosts: { where: { isActive: true } },
      surfacedJobs: { select: { reaction: true } },
      _count: { select: { weeklySprints: true } },
      coach: { select: { focus: true } },
    },
  })

  const latestAssessment = candidate.assessmentResponses[0]
  // See dossier-sections.ts's getHowIOperate for why this branches — a
  // rotationGroup-3 response uses a different dimension-key set than
  // translateDimensionVectors expects.
  const latestAssessmentVectors = latestAssessment?.dimensionVectors as Record<string, number> | undefined
  const dimensionSummary = latestAssessment
    ? 'definition' in (latestAssessmentVectors ?? {})
      ? translateWorkStyleVectors(latestAssessmentVectors as Record<string, number>)
      : translateDimensionVectors(latestAssessment.dimensionVectors as unknown as DimensionVectors)
    : null

  const latestResume = candidate.resumes[0]
  const hasResume = candidate.resumes.length > 0

  const marketConditions = await getMarketConditions({
    roleType: candidate.targetRoleType,
    primaryFunction: candidate.primaryFunction,
    city: candidate.currentCity,
    state: candidate.currentState,
  })

  // Additional, uncached, more-specific counts for the report's own market
  // commentary — role/location-level data alone doesn't tell a candidate
  // whether THEIR exact title or THEIR target industry has real openings.
  // Not run through the shared cache (src/lib/market/index.ts) since these
  // are one-off, highly specific queries, not the broad role-level lookup
  // that many candidates in the same function/location share.
  const marketWhere = candidate.currentCity
    ? `${candidate.currentCity} ${candidate.currentState ?? ''}`.trim()
    : candidate.currentState
  const exactTitle = candidate.targetRoleType && !isVagueTargetRole(candidate.targetRoleType)
    ? candidate.targetRoleType
    : null
  const targetIndustry = candidate.targetIndustries[0] ?? null

  const [titleSpecificResult, industrySpecificResult] = await Promise.all([
    exactTitle ? searchAdzunaJobs(exactTitle, marketWhere ?? null) : Promise.resolve(null),
    targetIndustry && candidate.primaryFunction
      ? searchAdzunaJobs(`${candidate.primaryFunction} ${targetIndustry}`, marketWhere ?? null)
      : Promise.resolve(null),
  ])
  // A 0 count on a highly specific query is far more likely to mean the
  // query itself didn't match anything sensible than a real, honest "zero
  // openings" fact — suppress rather than report a falsely precise zero.
  const titleSpecificCount =
    titleSpecificResult?.status === 'success' && titleSpecificResult.count && titleSpecificResult.count > 0
      ? titleSpecificResult.count
      : null
  const industrySpecificCount =
    industrySpecificResult?.status === 'success' &&
    industrySpecificResult.count &&
    industrySpecificResult.count > 0
      ? industrySpecificResult.count
      : null

  const managementGoalConflict = detectManagementGoalConflict(
    candidate.managementSkillConfidence,
    candidate.teamSizeManaged,
    candidate.targetRoleType
  )

  const [latestAiProject, jobPattern, applicationTrends, priorReport, marketRealitySnapshots] =
    await Promise.all([
      prisma.learningBadge.findFirst({
        where: { candidateId, badgeType: 'ai_project', judgmentCall: { not: null } },
        orderBy: { completedAt: 'desc' },
      }),
      generateJobPattern(candidateId),
      computeApplicationTrends(candidateId),
      // The most recent EXISTING report — relative to the new one about to
      // be generated below, this is "last time." Null on a candidate's
      // first-ever report, handled explicitly in the Executive Summary
      // prompt instructions above rather than fabricating a comparison.
      prisma.marketRealityReport.findFirst({ where: { candidateId }, orderBy: { generatedAt: 'desc' } }),
      prisma.marketRealitySnapshot.findMany({ where: { candidateId }, orderBy: { weekStartDate: 'asc' } }),
    ])

  // MRG §11 — refresh the 5-component Market Reality Grade composite
  // (MarketRealityComponentScore) in the same pass as everything else above,
  // so report generation is the one designated "recompute moment." Non-fatal
  // — the rest of the report must still generate even if a candidate has no
  // resume/data yet (computeMarketRealityCompositeGrade already returns null
  // in that case — see composite.ts).
  let newGradeHeadline: Awaited<ReturnType<typeof buildMarketRealityHeadline>> = null
  let compositeGrade: Awaited<ReturnType<typeof computeMarketRealityCompositeGrade>> = null
  try {
    await computeMarketRealityComponents(candidateId)
    compositeGrade = await computeMarketRealityCompositeGrade(candidateId)
    newGradeHeadline = await buildMarketRealityHeadline(candidateId)
  } catch (error) {
    console.error('Failed to refresh Market Reality Grade composite for report generation:', error)
  }

  // Up to 3 real, verbatim-quoted weak bullets from the latest ResumeAnalysis
  // (resume-analysis/compute.ts) — passed into part 8 of the prompt above so
  // the model can write a real before/after rewrite (Report Structure Spec
  // §3.3) instead of a generic instruction. Findings quote the offending
  // text in quotes; only the highest-point-value quoted findings are used.
  const latestResumeAnalysisFindings = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { dimensionFindings: true },
  })
  const weakBulletQuotes: string[] = latestResumeAnalysisFindings
    ? Object.values(latestResumeAnalysisFindings.dimensionFindings as unknown as Record<DimensionKey, Finding[]>)
        .flat()
        .sort((a, b) => b.estimatedPointGain - a.estimatedPointGain)
        .map((f) => f.candidateFacingCopy.match(/"([^"]+)"/)?.[1])
        .filter((quote): quote is string => !!quote)
        .filter((quote, i, arr) => arr.indexOf(quote) === i)
        .slice(0, 3)
    : []

  // Real, verified "what's new since last report" — every count here is a
  // genuine created/completed timestamp compared against the prior report's
  // generatedAt, never a guess. Only computed when a prior report exists;
  // see the Executive Summary prompt's first-report branch above.
  const [referencesCompletedSinceLastReport, applicationsSinceLastReport, outreachSinceLastReport] = priorReport
    ? await Promise.all([
        candidate.references.filter((r) => r.completedAt && r.completedAt > priorReport.generatedAt).length,
        prisma.jobPosting.count({ where: { candidateId, appliedAt: { gt: priorReport.generatedAt } } }),
        prisma.outreachLog.count({ where: { candidateId, loggedAt: { gt: priorReport.generatedAt } } }),
      ])
    : [0, 0, 0]
  const resumeUpdatedSinceLastReport = !!(latestResume && priorReport && latestResume.uploadedAt > priorReport.generatedAt)
  const assessmentCompletedSinceLastReport = !!(
    latestAssessment &&
    priorReport &&
    latestAssessment.completedAt > priorReport.generatedAt
  )
  const weeksOfImprovement = priorReport ? computeWeeksOfImprovement(marketRealitySnapshots) : 0

  // Same structured gap list the Market Reality Report UI and Executive
  // Dossier already compute (see named-reasons.ts) — passed into the action
  // plan prompt below so the 7-day plan can actually prioritize closing
  // gaps a hiring manager would notice, instead of being generated with no
  // awareness of them.
  const namedReasons = computeNamedReasons([], latestAiProject?.judgmentCall ?? null, {
    jobHoppingFlag: candidate.jobHoppingFlag,
    careerTrajectory: candidate.careerTrajectory,
    gapDuration: candidate.gapDuration,
  })

  const weekNumber = await getCandidateWeekNumber(candidate.id, getMondayOfWeek(new Date()))
  const directnessLevel = computeDirectnessLevel(
    weekNumber,
    isCasuallySearching(candidate.jobSearchDifficultyLevel, candidate.searchIntensity)
  )

  const summary = `
${DIRECTNESS_INSTRUCTION[directnessLevel]}

Market Reality Grade: ${
    newGradeHeadline
      ? `${newGradeHeadline.headline} ${newGradeHeadline.strongestLine} ${newGradeHeadline.constraintLine}`
      : 'not enough data yet to compute'
  }
Currently open gaps (named reasons a hiring manager would notice about this candidate right now — when choosing action-plan items in part 4 below, beyond what's already required, prioritize items that make progress on these, especially ones with an existing platform resource named):
  ${
    namedReasons
      .filter((r) => r.kind === 'gap')
      .map((r) => {
        const link = getNamedReasonActionLink(r.id)
        return `- ${r.text}${link ? ` (existing platform resource: ${link.label})` : ''}`
      })
      .join('\n  ') || 'none currently open'
  }
Target role: ${candidate.targetRoleType ?? 'not specified'}${isVagueTargetRole(candidate.targetRoleType) ? ' (vague/no clear direction — e.g. "flexible" or "open" rather than an actual title)' : ''}
Management/IC preference vs. goals conflict: ${
    managementGoalConflict
      ? `YES — they said they prefer to be an individual contributor, but ${
          managementGoalConflict.reason === 'large_team_managed'
            ? `they've managed a team of ${managementGoalConflict.teamSizeManaged}`
            : managementGoalConflict.reason === 'executive_target_role'
              ? `their target role ("${managementGoalConflict.targetRoleType}") is an executive-level title`
              : `they've managed a team of ${managementGoalConflict.teamSizeManaged} AND their target role ("${managementGoalConflict.targetRoleType}") is an executive-level title`
        }`
      : 'no'
  }
Target industries: ${candidate.targetIndustries.join(', ') || 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Highest level reached: ${candidate.highestLevelReached ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Target function: ${candidate.targetFunction ?? 'not specified'}
Industry background: ${candidate.industryContext ?? 'not specified'}
Considering a pivot to a different function/industry, not just changing employers: ${candidate.isPivoting ? 'yes' : 'no'}
Job status: ${candidate.currentJobStatus ? CURRENT_JOB_STATUS_LABELS[candidate.currentJobStatus] : 'not specified'}
Location preference: ${candidate.remotePreference ?? 'not specified'}
Known for: ${candidate.knownFor ?? 'not specified'}
Deal breakers: ${candidate.dealBreakers ?? 'not specified'}
How difficult their job search has been so far (1=taking their time, 4=getting desperate): ${candidate.jobSearchDifficultyLevel ?? 'not specified'}
Biggest barriers they believe they face: ${
    candidate.biggestBarriers.length > 0
      ? candidate.biggestBarriers
          .map((v) => BIGGEST_BARRIER_OPTIONS.find((o) => o.value === v)?.label ?? v)
          .join(', ')
      : 'not specified'
  }
Top strengths they identify with (up to 3): ${
    candidate.topStrengths.length > 0
      ? candidate.topStrengths.map((v) => TOP_STRENGTH_OPTIONS.find((o) => o.value === v)?.label ?? v).join(', ')
      : 'not specified'
  }
Tradeoff priorities, ranked most to least important: ${
    TRADEOFF_PRIORITIES.map((p) => ({ label: p.label as string, rank: candidate[p.key] }))
      .filter((p) => p.rank !== null)
      .sort((a, b) => (a.rank as number) - (b.rank as number))
      .map((p) => p.label)
      .join(' > ') || 'not specified'
  }

Work-style profile (self-reported): ${
    dimensionSummary
      ? Object.entries(dimensionSummary)
          .map(([dim, desc]) => `${dim}: ${desc}`)
          .join('; ')
      : 'assessment not completed'
  }

Work history: ${
    candidate.workHistory
      .map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`)
      .join('; ') || 'none listed'
  }

Completed references (qualitative): ${
    candidate.references
      .map((r) => `Strength: ${r.strengthSummary ?? 'n/a'}; Growth area: ${r.growthAreaSummary ?? 'n/a'}`)
      .join(' | ') || 'no completed references yet'
  }

Resume on file: ${hasResume ? 'yes' : 'no'}
Resume analysis: ${
    latestResume
      ? `ATS readability ${latestResume.atsScore ?? 'n/a'}/100 (${joinResumeFeedback(latestResume.atsFeedback) || 'n/a'}); Results-orientation ${latestResume.resultsScore ?? 'n/a'}/100 (${joinResumeFeedback(latestResume.resultsFeedback) || 'n/a'}); Experience evaluation ${latestResume.experienceScore ?? 'n/a'}/100 (${joinResumeFeedback(latestResume.experienceFeedback) || 'n/a'})`
      : 'no resume uploaded yet'
  }

Weak bullets to rewrite (for part 8 only — copy "before" verbatim from these): ${
    weakBulletQuotes.length > 0 ? weakBulletQuotes.map((q) => `"${q}"`).join(' | ') : 'none supplied'
  }

Job-fit feedback: ${
    candidate.jobPostings
      .map((j) => `${j.url}: fit ${j.fitScore}/100 — ${j.fitFeedback}`)
      .join(' | ') || 'no job postings analyzed yet'
  }

LinkedIn status confirmed: ${candidate.linkedInConfirmedAt ? 'yes' : 'no'}
LinkedIn URL on file: ${candidate.linkedInUrl ? 'yes' : 'no (candidate may have explicitly said they don’t have one yet)'}
LinkedIn posts logged in the last 30 days: ${candidate.linkedInActivityLogs.filter((l) => l.loggedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
Networking list (25 people) submitted: ${candidate.networkingListSubmittedAt ? 'yes' : 'no'}
Asked someone for help: ${candidate.askedForHelpAt ? 'yes' : 'no'}
Interview landed: ${
    candidate.jobPostings.filter((j) => j.interviewLandedAt !== null).map((j) => j.url).join(', ') || 'none'
  }
Offer received: ${
    candidate.jobPostings.filter((j) => j.offerReceivedAt !== null).map((j) => j.url).join(', ') || 'none'
  }

Profile confirmed: ${candidate.profileConfirmedAt ? 'yes' : 'no'}
Industry confirmed: ${candidate.industryConfirmedAt ? 'yes' : 'no'}
Function/title/years confirmed: ${candidate.functionConfirmedAt ? 'yes' : 'no'}
Salary/work authorization confirmed: ${candidate.salaryConfirmedAt && candidate.workAuthConfirmedAt ? 'yes' : 'no'}

Market data available: ${marketConditions.dataAvailable ? 'yes' : 'no'}
Market facts: ${
    marketConditions.dataAvailable
      ? [
          marketConditions.adzunaCount !== null
            ? `${marketConditions.adzunaCount} similar job openings currently listed on job boards near/matching their location`
            : null,
          marketConditions.blsYoyChangePct !== null
            ? `Occupational employment trend: ${marketConditions.blsYoyChangePct.toFixed(1)}% year-over-year change`
            : null,
        ]
          .filter(Boolean)
          .join('; ')
      : 'not available'
  }
Openings matching their exact target title: ${titleSpecificCount !== null ? `${titleSpecificCount} listed` : 'not available — do not mention a specific count'}
Openings matching their target function + industry: ${industrySpecificCount !== null ? `${industrySpecificCount} listed` : 'not available — do not mention a specific count'}

--- Report-over-report change (for the Executive Summary section only) ---
Is this the candidate's first-ever report: ${priorReport ? 'no' : 'yes'}
${
  priorReport
    ? `Previous report generated: ${priorReport.generatedAt.toISOString().slice(0, 10)}
Consecutive weeks of real improvement: ${weeksOfImprovement}
New data added since the previous report (credit these specifically, by name, only where true):
  - Completed references: ${referencesCompletedSinceLastReport}
  - Resume: ${resumeUpdatedSinceLastReport ? 'uploaded or updated' : 'no change'}
  - Work-style assessment: ${assessmentCompletedSinceLastReport ? 'completed' : 'no change'}
  - Applications submitted: ${applicationsSinceLastReport}
  - Networking outreach logged: ${outreachSinceLastReport}`
    : 'No prior report exists — this is their baseline, nothing to compare against.'
}
`.trim()

  let data: ReturnType<typeof marketRealityReportSchema.parse> | null | undefined
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      // Opus 5 (was the older opus-4-8) — the one place the premium model
      // earns its cost: this is the flagship artifact, generated once per
      // candidate rather than per interaction, and its quality sets the
      // first impression of the whole product.
      model: 'claude-opus-5',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(marketRealityReportSchema), effort: 'medium' },
      messages: [{ role: 'user', content: PROMPT_PREFIX + summary }],
    })
    const message = await stream.finalMessage()
    data = message.parsed_output
  } catch (error) {
    console.error('Failed to generate market reality report for candidate', candidateId, error)
    return
  }

  if (!data) return

  await prisma.marketRealityReport.create({
    data: {
      candidateId,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      hillToClimb: data.hillToClimb,
      actionPlan: normalizeActionPlan(data.actionPlan),
      gapAnalysis: data.gapAnalysis,
      marketConditions: marketConditions.dataAvailable
        ? {
            narrative: data.marketConditions?.narrative ?? [],
            adzunaCount: marketConditions.adzunaCount,
            blsYoyChangePct: marketConditions.blsYoyChangePct,
          }
        : Prisma.DbNull,
      jobSearchPattern: {
        summary: jobPattern.summary,
        signalCount: jobPattern.signalCount,
        minRequired: MIN_SIGNALS_FOR_PATTERN,
        applicationTrends,
      } as unknown as Prisma.InputJsonValue,
      executiveSummary: data.executiveSummary as unknown as Prisma.InputJsonValue,
      // Self-check (spec §6 rule 7): only persist rewrites whose "before"
      // matches one of the real quoted bullets actually supplied to the
      // model — drops anything hallucinated or paraphrased rather than
      // storing a pair that could show up next to the wrong (or no) real
      // finding at render time. market-reality-sections.ts's getResumeFixes
      // does the same match again at render time as a second, independent
      // check against the live ResumeAnalysis row.
      resumeRewrites: data.resumeRewrites.filter((r) => weakBulletQuotes.includes(r.before)) as unknown as Prisma.InputJsonValue,
    },
  })

  if (compositeGrade) {
    captureServerEvent(candidateId, 'grade_assigned', { grade: compositeGrade.grade })
  }
}
