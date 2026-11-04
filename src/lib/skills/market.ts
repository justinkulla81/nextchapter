// The skills market: which skills live postings ask for, and how that splits by industry, function, state and
// seniority. Pure and client-safe; the snapshot is computed in market-server.ts (cron /api/cron/skills-market).
// Tests: src/test/skills-market.test.ts.
//
// What a "skill" is here: a term the crawler read from a posting's full text (ExclusiveJobPosting.skills, the fixed
// vocabulary in companies/skills-extraction.ts). No model calls. Every list says what it counts.

import { skillSlug } from '@/lib/rankings/awards'

export type SkillDimension = 'industry' | 'function' | 'state' | 'level'

export const DIMENSIONS: { key: SkillDimension; label: string; plural: string }[] = [
  { key: 'industry', label: 'Industry', plural: 'industries' },
  { key: 'function', label: 'Function', plural: 'functions' },
  { key: 'state', label: 'State', plural: 'states' },
  { key: 'level', label: 'Seniority', plural: 'seniority levels' },
]

export const LEVEL_LABEL: Record<string, string> = {
  entry: 'Entry level',
  early: 'Early career',
  mid: 'Mid level',
  senior: 'Senior and principal',
  manager: 'Manager',
  director: 'Director and head',
  vp: 'VP and executive',
}
export const LEVEL_ORDER = Object.keys(LEVEL_LABEL)

export interface SkillRow {
  slug: string
  name: string
  /** Live postings that name the skill. */
  n: number
  /** Of those, posted in the last 30 days. */
  fresh: number
  /** Mean Anthropic Economic Index observed exposure of the occupations of postings asking for it; null when too few are matched. */
  exposure: number | null
  /** Postings that matched an occupation, the base of `exposure`. */
  exposureN: number
  /** Of the postings naming the skill, how many also name a specific AI skill. */
  aiPair: number
  /** Postings naming the skill, by dimension value key (only values with at least MIN_CELL). */
  by: Record<SkillDimension, Record<string, number>>
  /** Posted yearly pay of the postings that name it (midpoint of the range). Absent before the first snapshot that carries pay, and when too few state a yearly range. */
  pay?: SkillPay | null
  /** The jobs (occupations) that name it most, with their posted pay. Absent before the first snapshot that carries them. */
  jobs?: SkillJob[]
}

export interface SkillPay {
  /** Postings with a yearly range. */
  n: number
  /** Median of the midpoints, in dollars a year. */
  median: number
}

export interface SkillJob {
  soc: string
  title: string
  /** Live postings for this occupation that name the skill. */
  n: number
  /** Of those, how many state a yearly range, and their median midpoint (null under MIN_PAY_POSTINGS). */
  payN: number
  median: number | null
}

export interface SkillMarket {
  asOf: string
  /** Live postings. */
  live: number
  /** Live postings that name at least one skill: the base of every share here. */
  withSkills: number
  /** Of those, posted in the last 30 days. */
  fresh: number
  /** Postings that name a skill, per dimension value key: the base of a skill's share inside that value. */
  totals: Record<SkillDimension, Record<string, number>>
  /** Display label per dimension value key. */
  labels: Record<SkillDimension, Record<string, string>>
  skills: SkillRow[]
  /** Every live posting that names a skill and states a yearly range: what a skill's pay is compared with. */
  payBaseline?: SkillPay | null
}

export const MIN_CELL = 25
/** A skill needs this many postings before it is ranked anywhere. */
export const MIN_SKILL_POSTINGS = 300
export const MIN_EXPOSURE_POSTINGS = 200
/** A pay figure needs this many postings that state a yearly range, for a skill or for one of its jobs. */
export const MIN_PAY_POSTINGS = 30

const ACRONYMS = new Set([
  'sql', 'aws', 'gcp', 'sap', 'erp', 'crm', 'etl', 'sox', 'gaap', 'ifrs', 'seo', 'sem', 'hris', 'pmp', 'gdpr', 'hipaa',
  'api', 'ci/cd', 'fp&a', 'm&a', 'p&l ownership', 'rest api', 'ui', 'ux', 'kpi', 'okr', 'saas', 'b2b', 'b2c', 'aws', 'html', 'css',
  'php', 'sas', 'bi', 'cad', 'cpa', 'cfa', 'cissp', 'itil', 'ehr', 'emr', 'lms', 'mrp', 'wms', 'tms', 'rpa', 'nlp', 'llm',
])
const SPECIAL: Record<string, string> = {
  'javascript': 'JavaScript', 'typescript': 'TypeScript', 'node.js': 'Node.js', 'powerpoint': 'PowerPoint',
  'quickbooks': 'QuickBooks', 'netsuite': 'NetSuite', 'hubspot': 'HubSpot', 'salesforce': 'Salesforce', 'github': 'GitHub',
  'power bi': 'Power BI', 'databricks': 'Databricks', 'snowflake': 'Snowflake', 'graphql': 'GraphQL', 'devops': 'DevOps',
  'six sigma': 'Six Sigma', 'excel': 'Excel', 'python': 'Python', 'kubernetes': 'Kubernetes', 'tableau': 'Tableau',
}

/** A vocabulary term as members read it: "sql" → "SQL", "project management" → "Project management". */
export function skillLabel(term: string): string {
  const t = term.trim().toLowerCase()
  if (SPECIAL[t]) return SPECIAL[t]
  if (ACRONYMS.has(t)) return t.toUpperCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export const slugFor = (term: string) => skillSlug(term)

export const pct = (part: number, base: number): number => (base > 0 ? (part / base) * 100 : 0)
export const fmtPct = (v: number): string => (v >= 10 ? `${Math.round(v)}%` : `${Math.round(v * 10) / 10}%`)

const ranked = (m: SkillMarket) => m.skills.filter((s) => s.n >= MIN_SKILL_POSTINGS)

/** The skills the most postings name, overall. */
export function topSkills(m: SkillMarket, limit = 25): (SkillRow & { share: number })[] {
  return [...ranked(m)].sort((a, b) => b.n - a.n).slice(0, limit).map((s) => ({ ...s, share: pct(s.n, m.withSkills) }))
}

export interface DimensionValue {
  key: string
  label: string
  /** Postings naming a skill in this value. */
  total: number
}

/** Every value of a dimension with enough postings, biggest first. Levels keep their seniority order. */
export function dimensionValues(m: SkillMarket, dim: SkillDimension): DimensionValue[] {
  const out = Object.entries(m.totals[dim] ?? {})
    .filter(([, total]) => total >= MIN_CELL * 4)
    .map(([key, total]) => ({ key, label: m.labels[dim]?.[key] ?? key, total }))
  if (dim === 'level') return out.sort((a, b) => LEVEL_ORDER.indexOf(a.key) - LEVEL_ORDER.indexOf(b.key))
  return out.sort((a, b) => b.total - a.total)
}

/** The skills most asked for inside one industry, function, state or level, by the share of its postings. */
export function skillsIn(m: SkillMarket, dim: SkillDimension, key: string, limit = 20): (SkillRow & { count: number; share: number })[] {
  const base = m.totals[dim]?.[key] ?? 0
  return ranked(m)
    .map((s) => ({ ...s, count: s.by[dim]?.[key] ?? 0, share: pct(s.by[dim]?.[key] ?? 0, base) }))
    .filter((s) => s.count >= MIN_CELL)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** Where one skill is asked for most, in one dimension: by count of postings, with the share of that value's postings. */
export function placesForSkill(m: SkillMarket, skill: SkillRow, dim: SkillDimension, limit = 8): { key: string; label: string; count: number; share: number }[] {
  const rows = Object.entries(skill.by[dim] ?? {})
    .filter(([key, count]) => count >= MIN_CELL && (m.totals[dim]?.[key] ?? 0) > 0)
    .map(([key, count]) => ({ key, label: m.labels[dim]?.[key] ?? key, count, share: pct(count, m.totals[dim][key]) }))
  if (dim === 'level') return rows.sort((a, b) => LEVEL_ORDER.indexOf(a.key) - LEVEL_ORDER.indexOf(b.key))
  return rows.sort((a, b) => b.count - a.count).slice(0, limit)
}

const MIN_HOT = 1000

/**
 * Skills asked for more in the last 30 days of postings than across all open jobs: the share among fresh postings
 * divided by the share among every posting. Above 1 means the skill is gaining.
 */
export function hotSkills(m: SkillMarket, limit = 15): (SkillRow & { lift: number; freshShare: number; share: number })[] {
  if (m.fresh < 1000) return []
  return ranked(m)
    .filter((s) => s.n >= MIN_HOT && s.fresh >= 100)
    .map((s) => {
      const share = pct(s.n, m.withSkills)
      const freshShare = pct(s.fresh, m.fresh)
      return { ...s, share, freshShare, lift: share > 0 ? freshShare / share : 0 }
    })
    .filter((s) => s.lift > 1)
    .sort((a, b) => b.lift - a.lift)
    .slice(0, limit)
}

/** AI exposure of the work behind the skill: the highest (`most`) or lowest (`least`) mean observed exposure. */
export function skillsByExposure(m: SkillMarket, order: 'most' | 'least', limit = 12): (SkillRow & { exposure: number; share: number })[] {
  const rows = ranked(m)
    .filter((s): s is SkillRow & { exposure: number } => s.exposure !== null && s.exposureN >= MIN_EXPOSURE_POSTINGS && s.n >= 1000)
    .map((s) => ({ ...s, share: pct(s.n, m.withSkills) }))
  return rows.sort((a, b) => (order === 'most' ? b.exposure - a.exposure : a.exposure - b.exposure)).slice(0, limit)
}

/** Skills most often asked for alongside a specific AI skill: where AI is added to the work, not the whole job. */
export function aiComplementSkills(m: SkillMarket, limit = 12): (SkillRow & { aiShare: number })[] {
  return ranked(m)
    .filter((s) => s.n >= 1000)
    .map((s) => ({ ...s, aiShare: pct(s.aiPair, s.n) }))
    .sort((a, b) => b.aiShare - a.aiShare)
    .slice(0, limit)
}

export const findSkill = (m: SkillMarket, slug: string): SkillRow | null => m.skills.find((s) => s.slug === slug) ?? null

export interface SkillGap {
  /** In demand in the member's target (or overall), and the member does not show it. */
  missing: { slug: string; name: string; share: number }[]
  /** In demand and shown. */
  have: { slug: string; name: string; share: number }[]
}

/**
 * Compare a member's skills with the skills most asked for. `memberTerms` are the member's résumé keywords and confirmed
 * skills; a skill counts as shown on a whole-phrase, case-insensitive match. Scope narrows to one dimension value.
 */
export function skillGap(m: SkillMarket, memberTerms: string[], scope?: { dim: SkillDimension; key: string }, limit = 12): SkillGap {
  const mine = new Set(memberTerms.map((t) => t.trim().toLowerCase()).filter(Boolean))
  const list = scope ? skillsIn(m, scope.dim, scope.key, limit * 2) : topSkills(m, limit * 2)
  const have: SkillGap['have'] = []
  const missing: SkillGap['missing'] = []
  for (const s of list) {
    const row = { slug: s.slug, name: s.name, share: s.share }
    if (mine.has(s.name.toLowerCase()) || mine.has(s.slug.replace(/-/g, ' '))) have.push(row)
    else missing.push(row)
  }
  return { missing: missing.slice(0, limit), have: have.slice(0, limit) }
}

/** The one plain sentence under an exposure figure. */
export const SKILL_EXPOSURE_WHY =
  'Mean AI use observed in the occupations of the jobs that ask for this skill (Anthropic Economic Index). It describes the work, not a forecast of job loss, and a low number means no use seen yet.'

/**
 * How the posted pay of jobs that name a skill compares with the posted pay of all jobs that name any skill. This is a
 * comparison of postings, not a promise: skills cluster in particular kinds of job, so part of any gap is the job, not the skill.
 */
export function payPremium(s: Pick<SkillRow, 'pay'>, baseline: SkillPay | null | undefined): { pct: number; median: number; baseline: number; n: number } | null {
  if (!s.pay || s.pay.n < MIN_PAY_POSTINGS || !baseline || baseline.n < MIN_PAY_POSTINGS * 10 || baseline.median <= 0) return null
  return { pct: s.pay.median / baseline.median - 1, median: s.pay.median, baseline: baseline.median, n: s.pay.n }
}

export interface JobCell { soc: string; n: number; payN: number; median: number | null }

/** The jobs that name a skill most: the occupations with the most postings, named, one per title, with a pay figure only when enough postings state one. */
export function assembleJobs(cells: JobCell[], titleOf: (soc: string) => string | null, limit = 6): SkillJob[] {
  const seen = new Set<string>()
  const out: SkillJob[] = []
  for (const c of [...cells].sort((a, b) => b.n - a.n)) {
    const title = titleOf(c.soc)
    if (!title || seen.has(title)) continue
    seen.add(title)
    out.push({ soc: c.soc, title, n: c.n, payN: c.payN, median: c.median !== null && c.payN >= MIN_PAY_POSTINGS ? Math.round(c.median) : null })
    if (out.length >= limit) break
  }
  return out
}
