import type { AggregatedSkillGap } from '@/lib/jobs/job-skill-gap'

// Turns a member's aggregated skills gap into Market Reality content: facts for the
// report's prompt, deterministic gap-analysis entries, and an action-plan item.
// Pure, tested in src/test/skill-gap-report.test.ts.
//
// The gap items are merged in code AFTER the model writes the report, not left to
// the model to mention: the numbers are computed from real open roles, so they must
// appear exactly, every time, and cannot be softened or dropped by the prose.

// A skill is only worth calling a gap when it keeps coming up.
export const MIN_EMPLOYERS_FOR_GAP = 2
export const MAX_GAP_ITEMS = 3

const titleCase = (t: string) =>
  t
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bFp&a\b/, 'FP&A')
    .replace(/\bM&a\b/, 'M&A')
    .replace(/\b(Sql|Crm|Sap|Seo|Erp|Sox|Aws|Etl)\b/g, (m) => m.toUpperCase())

export function significantMissing(agg: AggregatedSkillGap) {
  return agg.missing.filter((m) => m.jobs >= MIN_EMPLOYERS_FOR_GAP).slice(0, MAX_GAP_ITEMS)
}

export function skillGapPromptSection(agg: AggregatedSkillGap | null): string {
  if (!agg || agg.jobsWithSkillData === 0) {
    return 'Skills gap against their best-fit open roles: not available (no open roles with skill data) — do not claim a specific skills gap from job postings.'
  }
  const missing = agg.missing.map((m) => `${m.term} (${m.jobs} of ${agg.jobsWithSkillData} employers)`).join('; ') || 'none'
  const have = agg.have.map((m) => `${m.term} (${m.jobs})`).join('; ') || 'none'
  return `Skills gap against their best-fit open roles (computed from real postings, not estimated):
  Employers with skill data among their ${agg.jobsConsidered} best-fit open roles: ${agg.jobsWithSkillData}
  Skills those roles ask for that their resume does not show: ${missing}
  Skills they show that these roles ask for: ${have}
  Reference these specific skills in gapAnalysis and the action plan where it helps; do not invent other skill gaps from this data.`
}

interface GapItem {
  area: string
  why: string
  remediation: string
  remediationType: 'upskilling' | 'fractional_contract' | 'consulting' | 'networking' | 'other'
}
interface GapAnalysis {
  targetRole: string
  gaps: GapItem[]
}

export function mergeSkillGapIntoGapAnalysis<T extends GapAnalysis>(gapAnalysis: T, agg: AggregatedSkillGap | null): T {
  if (!agg) return gapAnalysis
  const items = significantMissing(agg)
  if (items.length === 0) return gapAnalysis
  const existing = gapAnalysis.gaps.map((g) => `${g.area} ${g.why}`.toLowerCase())
  const added: GapItem[] = items
    .filter((m) => !existing.some((e) => e.includes(m.term.toLowerCase())))
    .map((m) => ({
      area: `Skill: ${titleCase(m.term)}`,
      why: `${m.jobs} of the ${agg.jobsWithSkillData} employers hiring for roles that fit you ask for it, and it is not on your resume.`,
      remediation:
        'If you have this, add it to your resume with a concrete result. If you do not, it is one of the most common things separating you from these roles — build it, or show a close equivalent, before you apply.',
      remediationType: 'upskilling' as const,
    }))
  return { ...gapAnalysis, gaps: [...added, ...gapAnalysis.gaps] }
}

interface PlanItem {
  text: string
  actionType?: string
}
interface PlanDay {
  day: number
  items: PlanItem[]
}

/** Adds one concrete action to the plan: close the most-requested missing skills. */
export function addSkillGapActionItem<T extends PlanDay>(plan: T[], agg: AggregatedSkillGap | null): T[] {
  if (!agg || plan.length === 0) return plan
  const items = significantMissing(agg)
  if (items.length === 0) return plan
  const names = items.map((m) => titleCase(m.term))
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const action: PlanItem = {
    text: `Close your skills gap: ${list} come up across the employers hiring roles that fit you, and are not on your resume. Add each one you genuinely have, with a result; for any you don't, pick the one asked for most and start building it this week.`,
    actionType: 'RESUME_UPDATE',
  }
  // Day 2 — after the first day's setup, early enough to matter this week.
  const idx = Math.min(1, plan.length - 1)
  return plan.map((d, i) => (i === idx ? { ...d, items: [...d.items, action] } : d))
}

// ── From the member's own applications (src/lib/applications) ──

/** The application gaps the report may cite: asked by at least this many applications. */
export const MIN_APPLICATIONS_FOR_GAP = 3

interface ApplicationGapLike {
  applications: number
  matchPct: number | null
  gaps: { term: string; applications: number; inferredOnly: boolean }[]
}

export function applicationGapPromptSection(apps: ApplicationGapLike | null): string {
  const items = (apps?.gaps ?? []).filter((g) => g.applications >= MIN_APPLICATIONS_FOR_GAP)
  if (!apps || items.length === 0) return 'Skills their own applications keep asking for: not enough applications to say.'
  return `Skills the jobs they applied to keep asking for that their profile does not show (computed from ${apps.applications} applications; match ${apps.matchPct ?? 'n/a'}%): ${items
    .map((g) => `${g.term} (${g.applications}${g.inferredOnly ? ', inferred from similar jobs' : ''})`)
    .join('; ')}
  Use these as stated; do not invent other skill gaps from them.`
}

/** Adds the top application gaps (not already named) to the report's gap analysis, after the market gaps. */
export function mergeApplicationGapsIntoGapAnalysis<T extends GapAnalysis>(gapAnalysis: T, apps: ApplicationGapLike | null): T {
  const items = (apps?.gaps ?? []).filter((g) => g.applications >= MIN_APPLICATIONS_FOR_GAP).slice(0, MAX_GAP_ITEMS)
  if (!apps || items.length === 0) return gapAnalysis
  const existing = gapAnalysis.gaps.map((g) => `${g.area} ${g.why}`.toLowerCase())
  const added: GapItem[] = items
    .filter((g) => !existing.some((e) => e.includes(g.term.toLowerCase())))
    .map((g) => ({
      area: `Skill: ${titleCase(g.term)}`,
      why: `${g.applications} of the ${apps.applications} jobs you applied to ${g.inferredOnly ? 'are the kind that ask' : 'asked'} for it, and it is not on your profile.`,
      remediation: 'If you have it, add it to your skills so your matches count it. If you do not, it is the most repeated gap in your own applications: build it or show a close equivalent.',
      remediationType: 'upskilling' as const,
    }))
  return { ...gapAnalysis, gaps: [...gapAnalysis.gaps, ...added] }
}
