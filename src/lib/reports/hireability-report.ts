// Generates the CANDIDATE-facing Hireability Report — strengths/weaknesses,
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
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { translateDimensionVectors, type DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { getMarketConditions } from '@/lib/market'
import { searchAdzunaJobs } from '@/lib/market/adzuna'
import { computeHireabilityGrade, GRADE_LABEL } from '@/lib/scoring/hireability-grade'
import { captureServerEvent } from '@/lib/posthog/server'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { BIGGEST_BARRIER_OPTIONS, TOP_STRENGTH_OPTIONS } from '@/lib/constants/onboarding'
import { computeDirectnessLevel, DIRECTNESS_INSTRUCTION } from '@/lib/scoring/directness-level'
import { hasStartedSprint } from '@/lib/weekly/sprint'
import { TIER_UNLOCKS } from '@/lib/community/unlock-tier'
import {
  CURRENT_JOB_STATUS_LABELS,
  isVagueTargetRole,
  detectManagementGoalConflict,
} from '@/lib/constants/onboarding'

export const actionPlanItemTypes = [
  'HELP_SCRIPT',
  'NETWORKING_LIST',
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

const hireabilityReportSchema = z.object({
  strengths: z.array(z.object({ title: z.string(), detail: z.string() })).min(3).max(6),
  weaknesses: z.array(z.object({ title: z.string(), detail: z.string() })).min(2).max(5),
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
})

type RawActionPlan = z.infer<typeof hireabilityReportSchema>['actionPlan']

// The model is asked for exactly 7 days but occasionally overshoots (an
// extra day, or a day numbered outside 1-7) while satisfying all the "HARD
// REQUIREMENT" items in the prompt above. Each entry's own items stay
// grouped together (they were written to make sense as a set) — this just
// keeps the first 7 entries in order and renumbers them 1-7, rather than
// rejecting the whole report over a cosmetic day-count/day-number slip.
function normalizeActionPlan(actionPlan: RawActionPlan): RawActionPlan {
  return actionPlan.slice(0, 7).map((day, i) => ({ ...day, day: i + 1 }))
}

const PROMPT_PREFIX = `${VICTORIA_VOICE_PROMPT}

You are writing this Hireability Report as Victoria, directly for the candidate — not for an employer, so show everything, no hedging or hiding of self-report contradictions. This report is built around two named grades (each A-F), given below: Market Reality Grade (their honest market position, some of it outside their control) and Search Action Grade (how well they're running the search itself — everyone can bring this one to an A). Reference these two grades and their individual dimensions/engines by name where relevant instead of a single generic "score."

HARD REQUIREMENT — no raw numbers, anywhere: never cite a raw numeric score (e.g. "88/100", "a 62") in any written field. Numbers below are for your own reasoning only. When referencing standing, use only the letter grade (A-F), its label (Excellent/Good/Average/Needs work/Critical gap), or its factor-type (Controllable/Influenceable/Structural) — never a number.

HARD REQUIREMENT — if "Started Search Sprint" below is "no", Search Action Grade has no real history to grade yet. Do not describe a specific Search Action Grade, dimension breakdown, or invented narrative about their execution so far — instead, in the hill-to-climb narrative, explain that Search Action Grade starts as a blank page and becomes real once they commit to their first Search Sprint.

Underlying theme to weave in naturally (don't force it into every section, but it must appear at least once, ideally in the hill-to-climb narrative or the action plan intro): not everyone who searches will land the role they want — that's the honest truth, never promise an outcome — but doing the real work meaningfully improves their odds, and Search Action Grade (not Market Reality Grade) is the lever entirely in their hands. When you introduce the action plan, briefly explain that following through on it is how they earn an A in Search Action Grade, and name what that unlocks as they build it up over time: ${TIER_UNLOCKS[5]} at Tier 5.

Write:
1. Strengths (3-6): specific, evidenced by their actual data below, not generic praise.
2. Weaknesses (2-5): an "accountability mirror," not a resume nitpick list — candidly name the ways this candidate could realistically fail or stall in a real search (self-report/reference contradictions, low job-search intensity, thin network activity, unrealistic target vs. actual experience, weak follow-through signals), evidenced by their actual data below. Be direct, not harsh. If "Target role" is flagged as vague/no clear direction below, combine that with their other motivation signals (job search intensity, tradeoff rankings, flexibility preferences) to name whether they seem to genuinely lack direction or just haven't written it down yet — don't treat vagueness alone as damning.
   - HARD REQUIREMENT: if "Management/IC preference vs. goals conflict" below is YES, name this tension as one of the weaknesses (or fold it into the gap analysis). Trust that they genuinely want to be an individual contributor — never suggest they secretly want to manage — but be direct that their team-management history and/or their stated target role point toward a more senior/managerial track, and they'll need to either retarget their search toward true IC-track roles (which may mean a different title or level than they wrote down) or consciously plan for the trade-off a more senior title actually requires (less hands-on work, more people management, even if that's not their preference).
   - HARD REQUIREMENT: if "Considering a pivot to a different function/industry" below is YES, straight talk is non-negotiable — do not soften or omit this: pivoting is genuinely harder than a lateral search. Name at least one concrete reason why in the weaknesses or hill-to-climb narrative — a longer realistic timeline, the extra work of translating past achievements into the target function/industry's language (on the resume, in interviews, in networking conversations), and a heavier dependence on warm introductions and networking since keyword-matched job boards won't surface an unconventional background. Never frame the pivot itself as a mistake or discourage it — only be honest about the work it requires.
3. Hill to climb: one honest, holistic evaluation of how hard finding a job will realistically be for this candidate, given everything below (their Market Reality Grade and Search Action Grade, experience, market conditions, job search intensity, consistency/self-awareness signals, resume/network completeness). Choose a "tone" — "very_positive" for strong candidates who are doing the right things, "positive_with_work" for solid candidates with real gaps, "significant_climb" for candidates facing a genuinely hard market position — and write 2-5 narrative sentences that are honest about the difficulty but never discouraging: always end on what raising their Search Action Grade (via the actions below) does to improve their odds, even where Market Reality Grade is structurally harder to move. Never imply either grade guarantees an outcome.
   - HARD REQUIREMENT: if "Considering a pivot to a different function/industry" below is YES, the tone and narrative must reflect that pivoting is a harder path than a lateral move (see the weaknesses instruction above) — never pick "very_positive" on the strength of a lateral candidate's profile alone if they're pivoting. Still end on what's in their control: the transferable-skills story they build, the networking they do, and the specificity of the target they pick all move the needle even on a pivot.
4. An action plan (exactly 7 days, each with concrete items). Each item has a "text" field and an optional "actionType" tag. Where relevant, reference real features of this platform: joining the Community Board (posting a job/project/intro or expressing interest in one), requesting a reference, uploading a work sample, adding a job posting for fit feedback.
   - HARD REQUIREMENT: if "Resume on file" below says "no", one of the 7 days MUST include uploading a resume, and must explain that it meaningfully improves their score and lets this report generate specific, evidence-based resume suggestions. If "Resume on file" says "yes", one of the 7 days MUST instead include applying this report's/the resume analysis's suggestions to improve it. Never do both, never do neither.
   - HARD REQUIREMENT: if "LinkedIn status confirmed" below says "no", one of the 7 days MUST include confirming whether they have a LinkedIn URL or don't have one yet, tagged actionType "LINKEDIN_SETUP". If "LinkedIn status confirmed" says "yes" but "LinkedIn URL on file" says "no", one of the 7 days MUST include actually creating a LinkedIn profile, tagged actionType "LINKEDIN_SETUP", explaining briefly why having one is critical to a modern job search (visibility to recruiters, network effects). If both say "yes", one of the 7 days MUST instead include concrete active-use steps — completing the profile fully, posting, being active daily — also tagged "LINKEDIN_SETUP".
   - HARD REQUIREMENT: one of the 7 days MUST include 3-7 separate items, each a distinct LinkedIn post-topic idea genuinely grounded in the candidate's real work history/achievements/function below (not generic "share an article" filler) — each such idea as its own item tagged actionType "LINKEDIN_POST_IDEA".
   - HARD REQUIREMENT: if "Networking list (25 people) submitted" below says "no", one of the 7 days MUST reference building and submitting that list of 25 people they know who could help their search, tagged actionType "NETWORKING_LIST". If it says "yes", do NOT include this item at all — it's already done.
   - HARD REQUIREMENT: if "Asked someone for help" below says "no", one of the 7 days MUST include reaching out to ask someone for help, tagged actionType "HELP_SCRIPT" — do NOT write the actual outreach message yourself, the platform already supplies a ready-to-use script; just reference that they should use it. If it says "yes", do NOT include this item at all — it's already done.
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

Candidate data:
`

export async function generateHireabilityReport(candidateId: string): Promise<void> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      assessmentResponses: { orderBy: { completedAt: 'desc' }, take: 1 },
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
  const dimensionSummary = latestAssessment
    ? translateDimensionVectors(latestAssessment.dimensionVectors as unknown as DimensionVectors)
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

  const grade = await computeHireabilityGrade(candidate)
  const startedSprint = await hasStartedSprint(candidateId)

  const weekNumber = candidate._count.weeklySprints + 1
  const directnessLevel = computeDirectnessLevel(
    weekNumber,
    isCasuallySearching(candidate.jobSearchDifficultyLevel, candidate.searchIntensity)
  )

  const summary = `
${DIRECTNESS_INSTRUCTION[directnessLevel]}

Started Search Sprint: ${startedSprint ? 'yes' : 'no'}
Market Reality Grade: ${grade.marketReality.grade} (${GRADE_LABEL[grade.marketReality.grade]}, ${grade.marketReality.score}/100)
  ${grade.marketReality.dimensions.map((d) => `${d.label} [${d.factorType}]: ${d.grade} (${d.score}/100)`).join('\n  ')}
Search Action Grade: ${grade.searchExecution.grade} (${GRADE_LABEL[grade.searchExecution.grade]}, ${grade.searchExecution.score}/100)
  ${grade.searchExecution.engines.map((e) => `${e.label} Engine: ${e.grade} (${e.score}/100)`).join('\n  ')}
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
      ? `ATS readability ${latestResume.atsScore ?? 'n/a'}/100 (${latestResume.atsFeedback.join('; ') || 'n/a'}); Results-orientation ${latestResume.resultsScore ?? 'n/a'}/100 (${latestResume.resultsFeedback.join('; ') || 'n/a'}); Experience evaluation ${latestResume.experienceScore ?? 'n/a'}/100 (${latestResume.experienceFeedback.join('; ') || 'n/a'})`
      : 'no resume uploaded yet'
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
`.trim()

  let data: ReturnType<typeof hireabilityReportSchema.parse> | null | undefined
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(hireabilityReportSchema), effort: 'medium' },
      messages: [{ role: 'user', content: PROMPT_PREFIX + summary }],
    })
    const message = await stream.finalMessage()
    data = message.parsed_output
  } catch (error) {
    console.error('Failed to generate hireability report for candidate', candidateId, error)
    return
  }

  if (!data) return

  await prisma.hireabilityReport.create({
    data: {
      candidateId,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      hillToClimb: data.hillToClimb,
      actionPlan: normalizeActionPlan(data.actionPlan),
      gapAnalysis: data.gapAnalysis,
      employabilityScoreAtGeneration: candidate.employabilityScore,
      hireabilityGradeAtGeneration: grade as unknown as Prisma.InputJsonValue,
      marketConditions: marketConditions.dataAvailable
        ? {
            narrative: data.marketConditions?.narrative ?? [],
            adzunaCount: marketConditions.adzunaCount,
            blsYoyChangePct: marketConditions.blsYoyChangePct,
          }
        : Prisma.DbNull,
    },
  })

  captureServerEvent(candidateId, 'grade_assigned', { grade: grade.searchExecution.grade })
}
