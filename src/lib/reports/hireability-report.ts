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
import type { ResumeFeedbackItem } from '@/lib/resume/analyze-resume'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { translateDimensionVectors, type DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { translateWorkStyleVectors } from '@/lib/scoring/work-style-vectors'
import { getMarketConditions } from '@/lib/market'
import { searchAdzunaJobs } from '@/lib/market/adzuna'
import { computeHireabilityGrade, GRADE_LABEL } from '@/lib/scoring/hireability-grade'
import { generateJobPattern, MIN_SIGNALS_FOR_PATTERN } from '@/lib/network/job-discovery'
import { computeApplicationTrends } from '@/lib/network/application-trends'
import { computeNamedReasons } from '@/lib/scoring/named-reasons'
import { getNamedReasonActionLink } from '@/lib/scoring/named-reason-ids'
import { captureServerEvent } from '@/lib/posthog/server'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { BIGGEST_BARRIER_OPTIONS, TOP_STRENGTH_OPTIONS, TRADEOFF_PRIORITIES } from '@/lib/constants/onboarding'
import { computeDirectnessLevel, DIRECTNESS_INSTRUCTION } from '@/lib/scoring/directness-level'
import { hasStartedSprint, getMondayOfWeek, getCandidateWeekNumber } from '@/lib/weekly/sprint'
import { TIER_UNLOCKS } from '@/lib/community/unlock-tier'
import {
  CURRENT_JOB_STATUS_LABELS,
  isVagueTargetRole,
  detectManagementGoalConflict,
} from '@/lib/constants/onboarding'

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

// Resume.atsFeedback/resultsFeedback/experienceFeedback are stored as
// Json[] of { issue, action } (see analyze-resume.ts) — flatten each pair
// into one line for this plain-text prompt context.
function joinResumeFeedback(feedback: Prisma.JsonValue[]): string {
  return (feedback as unknown as ResumeFeedbackItem[]).map((f) => `${f.issue} (Fix: ${f.action})`).join('; ')
}

const PROMPT_PREFIX = `${VICTORIA_VOICE_PROMPT}

You are writing this Hireability Report as Victoria, directly for the candidate — not for an employer, so show everything, no hedging or hiding of self-report contradictions. This report is built around one named grade, Current Market Reality (A-F), made up of six categories — Target Fit plus five hiring-manager competency categories (Leadership & Management, Skills & Execution, Communication & Collaboration, Adaptability & Change Readiness, Ownership & Reliability) — with weekly effort (Networking/Learning/Working) folded in as an input, not a second grade. Reference the grade and its individual categories by name where relevant instead of a single generic "score."

HARD REQUIREMENT — no raw numbers, anywhere: never cite a raw numeric score (e.g. "88/100", "a 62") in any written field. Numbers below are for your own reasoning only. When referencing standing, use only the letter grade (A-F) or its label (Excellent/Good/Average/Needs work/Critical gap) — never a number.

HARD REQUIREMENT — if "Started Search Sprint" below is "no", this week's effort has no real history yet. Do not invent a narrative about their execution so far — instead, in the hill-to-climb narrative, explain that weekly effort starts as a blank page and becomes real once they commit to their first Search Sprint.

HARD REQUIREMENT — never include "commit to your first Search Sprint," "start your Search Sprint," or any equivalent framing as one of the 7 action-plan day items. That's not a discrete task with a real link or a way to verify it — it's the platform's own weekly goal-setting mechanic, which already runs separately and already rewards itself. Mentioning it belongs only in the hill-to-climb narrative or the action-plan intro (see above), never as a checklist item a candidate would "mark done."

Underlying theme to weave in naturally (don't force it into every section, but it must appear at least once, ideally in the hill-to-climb narrative or the action plan intro): not everyone who searches will land the role they want — that's the honest truth, never promise an outcome — but doing the real work meaningfully improves their odds, and weekly effort is the lever entirely in their hands. When you introduce the action plan, briefly explain that following through on it is how they raise their Current Market Reality toward an A, and name what an A unlocks: we're ready to unabashedly support and market them as an excellent candidate, plus real perks as they build it up over time: ${TIER_UNLOCKS[5]} at Tier 5.

Write:
1. Strengths (3-6): specific, evidenced by their actual data below, not generic praise.
2. Weaknesses (2-5): an "accountability mirror," not a resume nitpick list — candidly name the ways this candidate could realistically fail or stall in a real search (self-report/reference contradictions, low job-search intensity, thin network activity, unrealistic target vs. actual experience, weak follow-through signals), evidenced by their actual data below. Be direct, not harsh. If "Target role" is flagged as vague/no clear direction below, combine that with their other motivation signals (job search intensity, tradeoff rankings, flexibility preferences) to name whether they seem to genuinely lack direction or just haven't written it down yet — don't treat vagueness alone as damning.
   - HARD REQUIREMENT: if "Management/IC preference vs. goals conflict" below is YES, name this tension as one of the weaknesses (or fold it into the gap analysis). Trust that they genuinely want to be an individual contributor — never suggest they secretly want to manage — but be direct that their team-management history and/or their stated target role point toward a more senior/managerial track, and they'll need to either retarget their search toward true IC-track roles (which may mean a different title or level than they wrote down) or consciously plan for the trade-off a more senior title actually requires (less hands-on work, more people management, even if that's not their preference).
   - HARD REQUIREMENT: if "Considering a pivot to a different function/industry" below is YES, straight talk is non-negotiable — do not soften or omit this: pivoting is genuinely harder than a lateral search. Name at least one concrete reason why in the weaknesses or hill-to-climb narrative — a longer realistic timeline, the extra work of translating past achievements into the target function/industry's language (on the resume, in interviews, in networking conversations), and a heavier dependence on warm introductions and networking since keyword-matched job boards won't surface an unconventional background. Never frame the pivot itself as a mistake or discourage it — only be honest about the work it requires.
3. Hill to climb: one honest, holistic evaluation of how hard finding a job will realistically be for this candidate, given everything below (their Current Market Reality and its categories, experience, market conditions, job search intensity, consistency/self-awareness signals, resume/network completeness). Choose a "tone" — "very_positive" for strong candidates who are doing the right things, "positive_with_work" for solid candidates with real gaps, "significant_climb" for candidates facing a genuinely hard market position — and write 2-5 narrative sentences that are honest about the difficulty but never discouraging: always end on what consistent weekly effort (via the actions below) does to improve their odds, even where Target Fit is structurally harder to move. Never imply the grade guarantees an outcome.
   - HARD REQUIREMENT: if "Considering a pivot to a different function/industry" below is YES, the tone and narrative must reflect that pivoting is a harder path than a lateral move (see the weaknesses instruction above) — never pick "very_positive" on the strength of a lateral candidate's profile alone if they're pivoting. Still end on what's in their control: the transferable-skills story they build, the networking they do, and the specificity of the target they pick all move the needle even on a pivot.
4. An action plan (exactly 7 days, each with concrete items). Each item has a "text" field and an optional "actionType" tag. Where relevant, reference real features of this platform: joining the Community Board (posting a job/project/intro or expressing interest in one), requesting a reference, uploading a work sample, adding a job posting for fit feedback.
   - HARD REQUIREMENT: write every item's "text" in this exact shape: a short action name (3-6 words, no reasoning in it) + " — " + one short clause on why it matters, in plain language a candidate would find compelling. Example: "Confirm your industry — recruiters match you on this first." The UI hyperlinks only the part before the dash, so the action name must stand alone as something clickable; never put the reason before the dash or omit the dash.
   - After satisfying every HARD REQUIREMENT item below, fill any remaining day slots with items that make progress on "Currently open gaps" (see candidate data below) rather than generic advice — when a gap lists an existing platform resource, point the candidate at it by name instead of re-deriving generic advice unrelated to any open gap.
   - HARD REQUIREMENT: if "Resume on file" below says "no", one of the 7 days MUST include uploading a resume, and must explain that it meaningfully improves their score and lets this report generate specific, evidence-based resume suggestions. If "Resume on file" says "yes", one of the 7 days MUST instead include applying this report's/the resume analysis's suggestions to improve it. Never do both, never do neither.
   - HARD REQUIREMENT: if "LinkedIn status confirmed" below says "no", one of the 7 days MUST include confirming whether they have a LinkedIn URL or don't have one yet, tagged actionType "LINKEDIN_SETUP". If "LinkedIn status confirmed" says "yes" but "LinkedIn URL on file" says "no", one of the 7 days MUST include actually creating a LinkedIn profile, tagged actionType "LINKEDIN_SETUP", explaining briefly why having one is critical to a modern job search (visibility to recruiters, network effects). If both say "yes", one of the 7 days MUST instead include concrete active-use steps — completing the profile fully, posting, being active daily — also tagged "LINKEDIN_SETUP".
   - HARD REQUIREMENT: one of the 7 days MUST include 3-7 separate items, each a distinct LinkedIn post-topic idea genuinely grounded in the candidate's real work history/achievements/function below (not generic "share an article" filler) — each such idea as its own item tagged actionType "LINKEDIN_POST_IDEA".
   - HARD REQUIREMENT: if "Networking list (25 people) submitted" below says "no", one of the 7 days MUST reference building and submitting that list of 25 people they know who could help their search, tagged actionType "NETWORKING_LIST". If it says "yes", do NOT include this item at all — it's already done.
   - HARD REQUIREMENT: if "Asked someone for help" below says "no", one of the 7 days MUST include reaching out to ask someone for help, tagged actionType "OUTREACH_MESSAGE" — do NOT write the actual outreach message yourself, the platform already supplies a ready-to-use script; just reference that they should use it. If it says "yes", do NOT include this item at all — it's already done.
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

  const [grade, startedSprint, latestAiProject, jobPattern, applicationTrends] = await Promise.all([
    computeHireabilityGrade(candidate),
    hasStartedSprint(candidateId),
    prisma.learningBadge.findFirst({
      where: { candidateId, badgeType: 'ai_project', judgmentCall: { not: null } },
      orderBy: { completedAt: 'desc' },
    }),
    generateJobPattern(candidateId),
    computeApplicationTrends(candidateId),
  ])

  // Same structured gap list the Market Reality Report UI and Executive
  // Dossier already compute (see named-reasons.ts) — passed into the action
  // plan prompt below so the 7-day plan can actually prioritize closing
  // gaps a hiring manager would notice, instead of being generated with no
  // awareness of them.
  const namedReasons = computeNamedReasons(grade.categories, latestAiProject?.judgmentCall ?? null, {
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

Started Search Sprint: ${startedSprint ? 'yes' : 'no'}
Current Market Reality: ${grade.grade} (${GRADE_LABEL[grade.grade]}, ${grade.score}/100)
  ${grade.categories.map((c) => `${c.label}: ${c.grade} (${c.score}/100)`).join('\n  ')}
Weekly effort: ${grade.weeklyPoints}/${grade.weeklyPointsTarget} points
  ${grade.weeklyEngines.map((e) => `${e.label}: ${e.grade} (${e.score}/100)`).join('\n  ')}
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
      // Opus 5 (was the older opus-4-8) — the one place the premium model
      // earns its cost: this is the flagship artifact, generated once per
      // candidate rather than per interaction, and its quality sets the
      // first impression of the whole product.
      model: 'claude-opus-5',
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
      hireabilityGradeAtGeneration: grade as unknown as Prisma.InputJsonValue,
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
    },
  })

  captureServerEvent(candidateId, 'grade_assigned', { grade: grade.grade })
}
