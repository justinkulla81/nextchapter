// Academic Affairs insights (owner, 2026-11-18): what a college does not already know about its alumni, the skills employers
// ask for, the employers hiring near it, and the retraining its alumni need. Pure: the server loads the rows
// (academic-insights-data.ts). Every count of alumni under MIN_CELL is hidden; no alumnus is ever named here.

import { normalizeOrgName } from '@/lib/text/org-name-match'
import { bandOf, type ExposureBand } from '@/lib/skills/ai-exposure'

export const MIN_CELL = 5

/** A count shown only from MIN_CELL up: smaller groups could point at one person. */
export const cell = (n: number): number | null => (n >= MIN_CELL ? n : null)

// ---- Employers hiring nearby ---------------------------------------------------------------------------------------

/** One employer's open professional roles in the college's region (a county scan, shared six hours). */
export interface RegionEmployerRow {
  name: string
  companyId: string | null
  /** Canonical normalized name, for the employer page link. */
  cn: string | null
  open: number
  entry: number
  /** Roles in occupations that typically need a four-year degree, by degree field (degrees-specs fieldOf). */
  fields: Record<string, number>
  paid: number
  payMed: number | null
  /** The employer's open roles nationally now and four weeks ago (CompanySignal, weekly), and layoffs filed in 12 months. */
  openNow: number | null
  open4wAgo: number | null
  warn12mo: number
  lastWarnAt: string | null
}

export type HiringTrend = 'growing' | 'steady' | 'cutting' | 'unknown'

/** Open roles now against four weeks ago, nationally: up or down by a fifth or more, from at least 10 roles. */
export function trendOf(now: number | null, before: number | null): { trend: HiringTrend; change: number | null } {
  if (now == null || before == null || before < 10) return { trend: 'unknown', change: null }
  const change = ((now - before) / before) * 100
  return { trend: change >= 20 ? 'growing' : change <= -20 ? 'cutting' : 'steady', change }
}

export interface EmployerInsight extends RegionEmployerRow {
  /** Roles in the fields this college's graduates go into. */
  inYourFields: number
  topField: string | null
  trend: HiringTrend
  change: number | null
}

/**
 * Employers ranked by roles in the college's own fields, then by all roles. One employer under two company records or in two
 * counties is one row; the college itself (any name that contains its own) is left out, since it is not a hiring lead for itself.
 */
export function employerInsights(rows: RegionEmployerRow[], yourFields: Set<string>, limit = 25, selfNames: string[] = []): EmployerInsight[] {
  const selves = selfNames.map((n) => normalizeOrgName(n)).filter((n) => n.length >= 4)
  const merged = new Map<string, RegionEmployerRow>()
  for (const r of rows) {
    const key = normalizeOrgName(r.name) || r.companyId || r.name
    if (selves.some((s) => key.includes(s))) continue
    const m = merged.get(key)
    if (!m) { merged.set(key, { ...r, fields: { ...r.fields } }); continue }
    // The same employer in two of the college's counties: add the counts, keep the larger sample's pay.
    m.open += r.open
    m.entry += r.entry
    if (m.openNow == null && r.openNow != null) { m.openNow = r.openNow; m.open4wAgo = r.open4wAgo }
    m.warn12mo = Math.max(m.warn12mo, r.warn12mo)
    for (const [f, n] of Object.entries(r.fields)) m.fields[f] = (m.fields[f] ?? 0) + n
    if (r.paid > m.paid) { m.paid = r.paid; m.payMed = r.payMed }
  }
  return [...merged.values()]
    .map((r) => {
      const inYourFields = Object.entries(r.fields).filter(([f]) => yourFields.has(f)).reduce((s, [, n]) => s + n, 0)
      const topField = Object.entries(r.fields).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      return { ...r, inYourFields, topField, ...trendOf(r.openNow, r.open4wAgo) }
    })
    .sort((a, b) => b.inYourFields - a.inYourFields || b.open - a.open || a.name.localeCompare(b.name))
    .slice(0, limit)
}

// ---- Alumni at risk --------------------------------------------------------------------------------------------------

export interface AlumniWork { employer: string | null; title: string | null }

/** An employer's signals, matched by normalized name to a Company and its hiring profile. */
export interface EmployerSignal { name: string; openNow: number | null; open4wAgo: number | null; warn12mo: number; warnEmployees12mo: number; lastWarnAt: string | null }

/** A layoff filing that names an employer where the college's alumni work (LayoffMatch, refreshed nightly). */
export interface LayoffHit { employerKey: string; employer: string; noticeDate: string | null; employees: number | null; where: string | null; alumni: number; sample: boolean }

export type RiskReason = 'layoff' | 'cutting'

export interface AtRiskEmployer {
  /** Normalized employer name, as alumni wrote it. */
  key: string
  employer: string
  /** Alumni who work there and share where they work; null under MIN_CELL. */
  alumni: number | null
  reasons: RiskReason[]
  /** One matched filing, or (`filings` set) every filing the employer made in 12 months: the count, their jobs in total and the latest date. */
  layoff: { noticeDate: string | null; employees: number | null; where: string | null; filings?: number } | null
  change: number | null
  /** The most common roles alumni hold there, each with at least MIN_CELL alumni. */
  roles: { title: string; n: number }[]
}

export interface AlumniAtRisk {
  /** Alumni who share where they work. */
  sharing: number
  /** Of those, at an employer that filed a layoff or is cutting hiring. */
  atRisk: number
  employers: AtRiskEmployer[]
  /** Alumni at employers whose hiring is growing: the other side of the same picture. */
  growing: { employer: string; alumni: number; change: number }[]
  sample: boolean
}

const titleKey = (t: string) => t.trim().replace(/\s+/g, ' ')

export function alumniAtRisk(work: AlumniWork[], signals: Map<string, EmployerSignal>, layoffs: LayoffHit[]): AlumniAtRisk {
  const byEmployer = new Map<string, { name: string; n: number; titles: Map<string, number> }>()
  for (const w of work) {
    if (!w.employer) continue
    const key = normalizeOrgName(w.employer)
    if (!key) continue
    const e = byEmployer.get(key) ?? { name: w.employer, n: 0, titles: new Map() }
    e.n += 1
    if (w.title) e.titles.set(titleKey(w.title), (e.titles.get(titleKey(w.title)) ?? 0) + 1)
    byEmployer.set(key, e)
  }
  const layoffBy = new Map(layoffs.map((l) => [l.employerKey, l]))
  const employers: AtRiskEmployer[] = []
  const growing: AlumniAtRisk['growing'] = []
  let atRisk = 0
  for (const [key, e] of byEmployer) {
    const sig = signals.get(key)
    const { trend, change } = sig ? trendOf(sig.openNow, sig.open4wAgo) : { trend: 'unknown' as const, change: null }
    const hit = layoffBy.get(key)
    const reasons: RiskReason[] = []
    if (hit || (sig && sig.warn12mo > 0)) reasons.push('layoff')
    if (trend === 'cutting') reasons.push('cutting')
    // The name as alumni wrote it: company records can carry odd casing ("Pnc").
    if (trend === 'growing' && change != null && e.n >= MIN_CELL) growing.push({ employer: e.name, alumni: e.n, change })
    if (reasons.length === 0) continue
    atRisk += e.n
    employers.push({
      key,
      employer: e.name,
      alumni: cell(e.n),
      reasons,
      layoff: hit ? { noticeDate: hit.noticeDate, employees: hit.employees, where: hit.where } : sig && sig.warn12mo > 0 ? { noticeDate: sig.lastWarnAt, employees: sig.warnEmployees12mo || null, where: null, filings: sig.warn12mo } : null,
      change,
      roles: [...e.titles].filter(([, n]) => n >= MIN_CELL).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, n]) => ({ title, n })),
    })
  }
  return {
    sharing: work.filter((w) => w.employer).length,
    atRisk,
    employers: employers.sort((a, b) => (b.alumni ?? 0) - (a.alumni ?? 0) || a.employer.localeCompare(b.employer)),
    growing: growing.sort((a, b) => b.alumni - a.alumni).slice(0, 8),
    sample: layoffs.some((l) => l.sample),
  }
}

// ---- Skills gaps -----------------------------------------------------------------------------------------------------

export interface AlumniSkillRow { primaryFunction: string | null; resumeKeywords: string[]; confirmedSkillsHave: string[]; certifications: string[] }

/** A skill as the job board's snapshot gives it for one function. */
export interface DemandSkill { slug: string; name: string; share: number; rising: boolean; ai: boolean }

export interface SkillGap {
  skill: string
  slug: string
  /** Share of the function's postings that ask for it. */
  demand: number
  /** Share of the college's alumni in that function whose résumé shows it; null under MIN_CELL alumni. */
  alumni: number | null
  gap: number | null
  rising: boolean
  ai: boolean
}

export interface FunctionGaps { fn: string; alumni: number; postings: number; gaps: SkillGap[] }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.&/ ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Does a person's skill text name this skill? Whole-word match on the skill's name or slug. */
export function hasSkill(text: string, skill: { name: string; slug: string }): boolean {
  const terms = [...new Set([norm(skill.name), norm(skill.slug.replace(/-/g, ' '))])].filter(Boolean)
  return terms.some((t) => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text))
}

/**
 * For each function where at least MIN_CELL of the college's alumni work: the skills its postings ask for most, against the
 * share of those alumni whose résumé shows each. The biggest gaps first, rising and AI skills flagged.
 */
export function skillGaps(rows: AlumniSkillRow[], demandFor: (fn: string) => { postings: number; skills: DemandSkill[] } | null, maxFunctions = 4, perFunction = 8): FunctionGaps[] {
  const byFn = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.primaryFunction) continue
    const text = norm([...r.resumeKeywords, ...r.confirmedSkillsHave, ...r.certifications].join(' | '))
    byFn.set(r.primaryFunction, [...(byFn.get(r.primaryFunction) ?? []), text])
  }
  const out: FunctionGaps[] = []
  for (const [fn, texts] of [...byFn].sort((a, b) => b[1].length - a[1].length)) {
    if (texts.length < MIN_CELL) continue
    const demand = demandFor(fn)
    if (!demand || demand.skills.length === 0) continue
    const gaps = demand.skills.map((d): SkillGap => {
      const have = texts.filter((t) => hasSkill(t, d)).length
      const share = have / texts.length
      return { skill: d.name, slug: d.slug, demand: d.share, alumni: share, gap: d.share - share, rising: d.rising, ai: d.ai }
    })
    out.push({ fn, alumni: texts.length, postings: demand.postings, gaps: gaps.sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)).slice(0, perFunction) })
    if (out.length >= maxFunctions) break
  }
  return out
}

// ---- Retraining demand -----------------------------------------------------------------------------------------------

/** One alumnus's role matched to an occupation and its AI exposure (Anthropic Economic Index), or not matched; and their employer. */
export interface RoleExposure { title: string; occupation: string | null; score: number | null; employerKey: string | null }

export interface Offering { name: string; kind: string; href: string; skills: string[] }

export interface RetrainingGroup {
  band: ExposureBand
  alumni: number | null
  /** The occupations most of them hold, each with at least MIN_CELL alumni. */
  occupations: { title: string; n: number }[]
}

/** `without`: alumni in the kind of work that asks for the skill whose résumé does not show it (null under MIN_CELL). */
export interface RetrainingSkill { skill: string; slug: string; fn: string; without: number | null; offerings: Offering[] }

export interface RetrainingDemand {
  matched: number
  unmatched: number
  groups: RetrainingGroup[]
  /** Alumni in high-exposure roles or at employers with layoffs or cutting hiring. */
  inNeed: number | null
  /** The skills that would move them, from the skills gaps, with the college's own programs that teach each; empty offerings = a program to build. */
  skills: RetrainingSkill[]
}

const teachesSkill = (o: Offering, skill: { name: string; slug: string }) => o.skills.some((s) => norm(s) === norm(skill.name) || norm(s) === norm(skill.slug.replace(/-/g, ' ')))

/** The employers flagged in Alumni at risk, so a person at one counts as in need. */
export const riskKeys = (a: AlumniAtRisk): Set<string> => new Set(a.employers.map((e) => e.key))

export function retrainingDemand(roles: RoleExposure[], riskEmployers: Set<string>, gaps: FunctionGaps[], offerings: Offering[], limit = 10): RetrainingDemand {
  const matched = roles.filter((r) => r.score != null)
  const groups: RetrainingGroup[] = (['high', 'some', 'little'] as ExposureBand[]).map((band) => {
    const inBand = matched.filter((r) => bandOf(r.score as number) === band)
    const occ = new Map<string, number>()
    for (const r of inBand) if (r.occupation) occ.set(r.occupation, (occ.get(r.occupation) ?? 0) + 1)
    return { band, alumni: cell(inBand.length), occupations: [...occ].filter(([, n]) => n >= MIN_CELL).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([title, n]) => ({ title, n })) }
  })
  // Each person once: in a high-exposure role, or at a flagged employer, or both.
  const inNeed = roles.filter((r) => (r.score != null && bandOf(r.score) === 'high') || (r.employerKey != null && riskEmployers.has(r.employerKey))).length
  // The skills to retrain for: the largest gaps across functions, rising and AI skills first, each once.
  const seen = new Set<string>()
  const pool = gaps.flatMap((g) => g.gaps.map((s) => ({ ...s, fn: g.fn, need: Math.round((1 - (s.alumni ?? 0)) * g.alumni) })))
    .filter((s) => (s.gap ?? 0) > 0)
    // Rising and AI-related skills first, then the largest gap (not the headcount, which only says how big the group is), and at
    // most PER_FUNCTION from one kind of work so the list covers every group.
    .sort((a, b) => Number(b.rising || b.ai) - Number(a.rising || a.ai) || (b.gap ?? 0) - (a.gap ?? 0))
  const PER_FUNCTION = 3
  const perFn = new Map<string, number>()
  const skills: RetrainingSkill[] = []
  for (const s of pool) {
    if (seen.has(s.slug) || (perFn.get(s.fn) ?? 0) >= PER_FUNCTION) continue
    seen.add(s.slug)
    perFn.set(s.fn, (perFn.get(s.fn) ?? 0) + 1)
    skills.push({ skill: s.skill, slug: s.slug, fn: s.fn, without: cell(s.need), offerings: offerings.filter((o) => teachesSkill(o, { name: s.skill, slug: s.slug })) })
    if (skills.length >= limit) break
  }
  return { matched: matched.length, unmatched: roles.length - matched.length, groups, inNeed: cell(inNeed), skills }
}
