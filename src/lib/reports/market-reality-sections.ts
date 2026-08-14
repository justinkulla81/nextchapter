// Live-rendered sections for the rebuilt Market Reality Report — MRG §11,
// per docs/specs/NextChapter_Report_Structure_Spec.md. These are NOT part
// of the LLM-generated/persisted report row: they read straight from the
// already-persisted, single-source-of-truth tables (MarketRealityComponentScore,
// ResumeAnalysis, ReviewerQuestion, AtsParseResult) at page-render time, so
// they can never drift from the score they describe (spec §6 rule 1) and so
// resolving a reviewer question makes it disappear immediately without a
// full report regeneration (spec §3.4: "recording it removes the item").
//
// Deliberately template-only, zero LLM calls — same reasoning as
// market-reality/narrative.ts's headline: pure prose over real numbers
// can't contradict the numbers it describes the way free-form generation
// can.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { scoreToGrade, type Grade } from '@/lib/scoring/grade'
import { buildMarketRealityHeadline, type MarketRealityHeadline } from '@/lib/scoring/market-reality/narrative'
import { DIMENSION_LABEL, REVIEWER_DETECTION_FOLLOWUP, type DimensionKey, type Finding, type ReviewerDetectionType } from '@/lib/scoring/resume-analysis/types'
import { getActiveReviewerDetections } from '@/lib/scoring/market-reality/reviewer-detections'

// ── Section 1: "Where you stand" ────────────────────────────────────────

export interface WhereYouStand {
  grade: Grade
  headline: MarketRealityHeadline
  decomposition: { label: string; grade: Grade; control: 'High' | 'None'; note: string }[]
  weeklyHours: string
  realisticPath: string
}

// Exported (not just used internally) so the deterministic-template gates
// in src/test/scoring-fixtures.test.ts (Master Build Script §16 gates 6/19)
// can assert exhaustiveness and tonal consistency directly against these
// tables — this file is explicitly template-only/zero-LLM (see header),
// which is exactly what makes that a meaningful, non-flaky assertion.
export const WEEKLY_HOURS_BY_GRADE: Record<Grade, string> = {
  A: '3–5 hrs/week',
  B: '6–10 hrs/week',
  C: '6–10 hrs/week',
  D: '10–15 hrs/week',
  F: '15+ hrs/week, longer horizon',
}

// Report Structure Spec §5.2 — different bands get different realistic
// primary paths, not the same ladder with a longer climb. A and A− collapse
// to one row since Grade has no A− value.
export const REALISTIC_PATH_BY_GRADE: Record<Grade, string> = {
  A: 'Warm channels, search firms, selectivity. Speed matters more than volume.',
  B: 'Fix presentation, add references, apply with intent. The standard path works.',
  C: 'Presentation fixes plus positioning. Consider adjacent functions and less competitive markets. Interim work to generate current proof.',
  D: 'Interim, contract, and fractional work first — this generates the evidence the resume lacks. Reframe around a narrower, more attainable target. Skills with a named gap.',
  F: 'Rebuild before searching. Often a function or level reset. Coaching is the highest-value lever, not applications.',
}

export async function getWhereYouStand(candidateId: string): Promise<WhereYouStand | null> {
  const [row, headline] = await Promise.all([
    prisma.marketRealityComponentScore.findUnique({ where: { candidateId } }),
    buildMarketRealityHeadline(candidateId),
  ])
  if (!row || !headline || row.grade === null) return null

  const grade = row.grade as Grade
  const decomposition: WhereYouStand['decomposition'] = []

  if (row.experienceScore !== null && row.resumeScore !== null) {
    const recordScore = Math.round((row.experienceScore + row.resumeScore) / 2)
    decomposition.push({
      label: 'How your record reads',
      grade: scoreToGrade(recordScore),
      control: 'High',
      note: 'Fully in your control — days to weeks to fix.',
    })
  }
  if (row.marketScore !== null) {
    decomposition.push({
      label: 'How many roles exist',
      grade: scoreToGrade(row.marketScore),
      control: 'None',
      note: 'Level, function, and geography — scarcity rises with seniority.',
    })
  }
  if (row.effortScore !== null) {
    decomposition.push({
      label: 'How strong your warm network is',
      grade: scoreToGrade(row.effortScore),
      control: 'High',
      note: 'The dominant channel above director level — weeks to months to build.',
    })
  }

  return {
    grade,
    headline,
    decomposition,
    weeklyHours: WEEKLY_HOURS_BY_GRADE[grade],
    realisticPath: REALISTIC_PATH_BY_GRADE[grade],
  }
}

// ── Section 3: "What to fix on your resume" ─────────────────────────────

export interface ResumeRewrite {
  before: string
  after: string
}

export interface ResumeFixItem {
  dimension: string
  severity: Finding['severity']
  whatsWrong: string
  fix: string
  pointValue: number
  rewrite: ResumeRewrite | null
}

// Findings quote the offending text verbatim in quotes, e.g. `"Responsible
// for..." describes a duty, not a result.` — used to match a stored
// rewrite's `before` back to the finding it belongs to.
function extractQuote(text: string): string | null {
  const match = text.match(/"([^"]+)"/)
  return match ? match[1] : null
}

export async function getResumeFixes(
  candidateId: string,
  rawRewrites: unknown
): Promise<{ items: ResumeFixItem[]; resumeBand: string; experienceBand: string } | null> {
  const analysis = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { dimensionFindings: true, resumeBand: true, experienceBand: true },
  })
  if (!analysis) return null

  const rewrites = Array.isArray(rawRewrites) ? (rawRewrites as ResumeRewrite[]) : []
  const findings = analysis.dimensionFindings as unknown as Record<DimensionKey, Finding[]>

  const items: ResumeFixItem[] = Object.entries(findings)
    .flatMap(([dimensionKey, findingsForDimension]) =>
      findingsForDimension.map((f) => {
        const quote = extractQuote(f.candidateFacingCopy)
        // Self-check (spec §6 rule 7): only attach a rewrite whose stored
        // `before` matches this finding's real quoted text exactly — never
        // show a rewrite next to a finding it wasn't generated for.
        const rewrite = quote ? (rewrites.find((r) => r.before === quote) ?? null) : null
        return {
          dimension: DIMENSION_LABEL[dimensionKey as DimensionKey],
          severity: f.severity,
          whatsWrong: f.candidateFacingCopy,
          fix: f.fix,
          pointValue: f.estimatedPointGain,
          rewrite,
        }
      })
    )
    .filter((item) => item.pointValue > 0 || item.rewrite !== null)
    .sort((a, b) => b.pointValue - a.pointValue)

  return { items, resumeBand: analysis.resumeBand, experienceBand: analysis.experienceBand }
}

// ── Section 4: "How a recruiter will read this" ─────────────────────────

export interface RecruiterReadItem {
  id: string
  whatAReviewerNotices: string
  followUpPrompt: string
}

function contextString(ctx: Record<string, unknown>, key: string): string {
  const value = ctx[key]
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

const WHAT_A_REVIEWER_NOTICES: Record<ReviewerDetectionType, (ctx: Record<string, unknown>) => string> = {
  UNEXPLAINED_RECENT_GAP: (ctx) =>
    `A ${contextString(ctx, 'gapMonths')}-month gap between ${contextString(ctx, 'before')} and ${contextString(ctx, 'after')}. A reviewer will ask what happened — if it was a contract role, a layoff, or a company that ran out of runway, say so plainly in one line. Unexplained is worse than any actual reason.`,
  UNEXPLAINED_CURRENT_GAP: (ctx) =>
    `Nothing listed since ${contextString(ctx, 'lastRole')} ended. A reviewer will ask what you're doing now and what you're targeting next.`,
  SHORT_TENURE_RECENT: (ctx) =>
    `A ${contextString(ctx, 'months')}-month stint as ${contextString(ctx, 'role')} at ${contextString(ctx, 'company')}. A reviewer will ask what happened — a mismatch, a layoff, or a fixed-term role are all plainly explainable.`,
  SHORT_TENURE_CLUSTER: (ctx) => {
    const roles = Array.isArray(ctx.roles) ? (ctx.roles as string[]).join(', ') : 'your recent roles'
    return `A recent sequence of shorter moves (${roles}). A reviewer will ask what's behind the pattern — naming the real reason (restructuring, a layoff wave, a deliberate pivot) reads better than leaving it to guesswork.`
  },
  SCOPE_DECREASE: (ctx) =>
    `The move from ${contextString(ctx, 'from')} to ${contextString(ctx, 'to')} reads like a step down in scope. A reviewer will ask why — a deliberate trade for mission, flexibility, or a turnaround opportunity is a real, credible answer.`,
  THIN_RECENT_ENTRY: (ctx) =>
    `Your most recent role, ${contextString(ctx, 'role')} at ${contextString(ctx, 'company')}, has noticeably less detail than the rest of your resume. A reviewer will assume there's less to say rather than less written down.`,
  EXTENDED_TENURE_NO_CHANGE: (ctx) =>
    `${contextString(ctx, 'years')} years in the same title as ${contextString(ctx, 'role')}. A reviewer will ask whether that reflects real growth in scope or a plateau.`,
  TITLE_INFLATION: (ctx) =>
    `Your title, ${contextString(ctx, 'role')} at ${contextString(ctx, 'company')}, isn't backed by a scope number on the page. A reviewer will size the role from the numbers, not the title.`,
  OVERLAPPING_ROLES: (ctx) =>
    `${contextString(ctx, 'a')} and ${contextString(ctx, 'b')} overlap in time. A reviewer will ask which one was actually full-time.`,
  CREDENTIAL_NO_INSTITUTION: (ctx) =>
    `Your ${contextString(ctx, 'degree')} doesn't name the granting school. A reviewer may ask, or an ATS may simply drop the credential.`,
  PORTFOLIO_CAREER: (ctx) =>
    `${contextString(ctx, 'count')} concurrent board/advisory roles. A reviewer will wonder whether you're seeking a full-time operating role or building a portfolio career — worth stating plainly if it's the former.`,
  COMP_FIT_RISK: (ctx) =>
    `Given the scope of ${contextString(ctx, 'role')}, a reviewer may wonder about comp fit for the level you're targeting now — worth a line on why this level, this next chapter.`,
}

export async function getRecruiterReadItems(candidateId: string): Promise<RecruiterReadItem[]> {
  const detections = await getActiveReviewerDetections(candidateId)
  return detections.map((d) => ({
    id: d.id,
    whatAReviewerNotices: WHAT_A_REVIEWER_NOTICES[d.detectionType](d.detectedContext),
    followUpPrompt: REVIEWER_DETECTION_FOLLOWUP[d.detectionType],
  }))
}

// ── Section 5: "Getting past the filters" (ATS matrix) ──────────────────

export interface AtsMatrixSection {
  cleanParsers: string[]
  issues: { parserLabel: string; failures: string[]; severity: 'PARTIAL' | 'FAILING' }[]
}

export async function getAtsMatrix(candidateId: string): Promise<AtsMatrixSection | null> {
  const analysis = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { atsParseResults: true },
  })
  if (!analysis || analysis.atsParseResults.length === 0) return null

  const cleanParsers = analysis.atsParseResults.filter((r) => r.severity === 'CLEAN').map((r) => r.parserLabel)
  const issues = analysis.atsParseResults
    .filter((r): r is typeof r & { severity: 'PARTIAL' | 'FAILING' } => r.severity === 'PARTIAL' || r.severity === 'FAILING')
    .map((r) => ({ parserLabel: r.parserLabel, failures: r.failures as unknown as string[], severity: r.severity }))

  return { cleanParsers, issues }
}

// ── Section 6: "What else moves the needle" ──────────────────────────────

export interface MoveTheNeedleLever {
  key: string
  label: string
  need: number // 0-100, higher = ranks higher (computed per candidate, spec §3.6)
  copy: string
  href: string
}

const REFERENCE_TARGET = 5

export async function getMoveTheNeedle(candidateId: string): Promise<MoveTheNeedleLever[]> {
  const [componentRow, completedReferencesCount, analysis, activeInterim, candidate, reviewerDetections] = await Promise.all([
    prisma.marketRealityComponentScore.findUnique({ where: { candidateId } }),
    prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
    prisma.resumeAnalysis.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { dimensionFindings: true },
    }),
    prisma.workHistoryEntry.findFirst({
      where: { candidateId, isCurrent: true, engagementType: { in: ['FRACTIONAL', 'INTERIM', 'CONSULTING'] } },
      select: { id: true },
    }),
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { connectedWithRecruiters: true, triedExecutiveCoaching: true, coachId: true },
    }),
    getActiveReviewerDetections(candidateId),
  ])

  const levers: MoveTheNeedleLever[] = []

  // References -> the Dossier.
  levers.push({
    key: 'REFERENCES',
    label: 'References — the Dossier',
    need: Math.round(100 * (1 - Math.min(completedReferencesCount, REFERENCE_TARGET) / REFERENCE_TARGET)),
    copy:
      completedReferencesCount >= REFERENCE_TARGET
        ? `You have ${completedReferencesCount} completed references — third-party corroboration is already doing real work for you here.`
        : `You have ${completedReferencesCount} of ${REFERENCE_TARGET} completed references. Third-party corroboration is the only thing that converts self-reported claims into verified ones — it costs you nothing but an ask.`,
    href: '/dashboard/references',
  })

  // Your Network — reuse the exact driver sentence already computed by
  // Effort component (market-reality/effort.ts), so this never has to
  // recompute or risk disagreeing with the number shown in "Where you
  // stand."
  const networkDriver = (componentRow?.effortDrivers as string[] | null)?.[0] ?? null
  levers.push({
    key: 'NETWORK',
    label: 'Your Network',
    need: componentRow?.effortScore !== null && componentRow?.effortScore !== undefined ? 100 - componentRow.effortScore : 50,
    copy: networkDriver ?? 'Warm introductions are the dominant channel above director level — worth activating even lightly.',
    href: '/dashboard/network',
  })

  // Skills — named gap only, from the Resume dimension's own finding.
  const findings = (analysis?.dimensionFindings ?? {}) as unknown as Record<DimensionKey, Finding[]>
  const skillFinding = findings.skillCurrency?.[0] ?? null
  levers.push({
    key: 'SKILLS',
    label: 'Skills',
    need: skillFinding ? 65 : 25,
    copy: skillFinding
      ? `${skillFinding.candidateFacingCopy} ${skillFinding.fix}`
      : 'No specific skill gap named right now — nothing generic to chase here.',
    href: '/dashboard/learning',
  })

  // Interim, fractional, and contract work.
  const hasUnexplainedGap = reviewerDetections.some(
    (d) => d.detectionType === 'UNEXPLAINED_CURRENT_GAP' || d.detectionType === 'UNEXPLAINED_RECENT_GAP'
  )
  levers.push({
    key: 'INTERIM',
    label: 'Interim, fractional, and contract work',
    need: activeInterim ? 10 : hasUnexplainedGap ? 80 : 40,
    copy: activeInterim
      ? "You're currently active in interim/fractional work — that stays in market and keeps generating current proof points."
      : hasUnexplainedGap
        ? 'A short interim or contract engagement would close the gap on your resume with real, current, quantified work — while you keep searching.'
        : 'Interim or fractional work stays in market and generates current proof points, even between full-time roles.',
    href: '/dashboard/resume',
  })

  // Recruiter network and exclusive roles.
  levers.push({
    key: 'RECRUITER_NETWORK',
    label: 'Recruiter network and exclusive roles',
    need: candidate?.connectedWithRecruiters ? 15 : 55,
    copy: candidate?.connectedWithRecruiters
      ? "You're already connected with recruiters — keep that relationship active for roles that never get posted."
      : "You haven't connected with recruiters yet — this is real access to roles that aren't posted anywhere.",
    href: '/dashboard/find-my-job',
  })

  // Coaching — highest-value where difficulty concentrates in interviewing/positioning.
  const grade = componentRow?.grade as Grade | null
  const difficultyConcentrated = grade === 'D' || grade === 'F'
  levers.push({
    key: 'COACHING',
    label: 'Coaching',
    need: !candidate?.triedExecutiveCoaching && !candidate?.coachId && difficultyConcentrated ? 85 : candidate?.coachId ? 5 : 30,
    copy: candidate?.coachId
      ? "You're already working with a coach — keep using those sessions to sharpen interviewing and positioning."
      : difficultyConcentrated
        ? "Coaching is the highest-leverage lever available to you right now — most of what's holding this search back is interviewing and positioning, not the market."
        : 'Coaching helps most once the resume and market fundamentals are already solid — worth considering once those are further along.',
    href: '/dashboard',
  })

  return levers.sort((a, b) => b.need - a.need)
}
