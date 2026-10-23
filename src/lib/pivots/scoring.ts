// Ranks a member's pivot paths by fit x market demand x upside, and says
// whether the member's own kind of work is contracting. Pure: every input is
// passed in (load.ts reads them), so the rules are unit-tested end to end.
//
// What members see is labels and counts of real jobs, never these internal
// scores: "Strong fit", "412 open roles near you", "pay about 10% higher".

import { CUSTOMER_SERVICE_TREND, OCCUPATION_TRENDS } from '@/lib/market/occupation-trends-data'
import { estimatePayChange, type PayBenchmarkRow } from '@/lib/outcomes/pay-change-estimate'
import {
  GAP_WAY_LABEL,
  ROLES,
  TIME_LABEL,
  detectSourceRole,
  type EdgeFit,
  type PeopleContact,
  type PivotEdge,
  type PivotRole,
  type TimeToPivot,
} from './pivot-map'
import { likesFit, workFit, type Likes, type WorkProfile } from '@/lib/profile/work-profile'
import { strengthNotes, type StrengthKeys } from '@/lib/profile/strengths'
import { aiOutlookForRole, type AiOutlook } from '@/lib/profile/ai-outlook'
import { outlookForRole, outlookLine, outlookMultiplier, ROLE_SOC } from './occupation-outlook'
import { cycleLineForSoc } from './occupation-cycle'
import { ONET_EDGE_MIN_OPEN, edgesFor, onetGaps, type OnetGaps } from './onet'

// ── Inputs ──────────────────────────────────────────────────────────────────

export type Band = 'IC' | 'MANAGER' | 'DIRECTOR' | 'EXEC'
export const BANDS: Band[] = ['IC', 'MANAGER', 'DIRECTOR', 'EXEC']

export type PeopleEnergy = 'HIGH' | 'SOME' | 'LOW'
export const PEOPLE_ENERGY_OPTIONS: { value: PeopleEnergy; label: string }[] = [
  { value: 'HIGH', label: 'Energized by lots of people contact' },
  { value: 'SOME', label: 'Some' },
  { value: 'LOW', label: 'Prefer focused solo work' },
]
export function isPeopleEnergy(v: unknown): v is PeopleEnergy {
  return v === 'HIGH' || v === 'SOME' || v === 'LOW'
}

export interface MemberPivotInput {
  /** Latest job title (resume), when known. */
  title: string | null
  primaryFunction: string | null
  /** Where they said they want to go (aspirational function), if set. */
  targetFunction: string | null
  highestLevelReached: string | null
  isPivoting: boolean
  /** Two-letter state code. */
  state: string | null
  remotePreference: string | null
  openToRelocation: boolean
  /** Resume keywords, confirmed skills and certifications, any case. */
  skills: string[]
  targetCompMin: number | null
  /** Self-reported answer to the people-contact question (wins over the assessment). */
  peopleEnergyAnswer: PeopleEnergy | null
  /** "Live and together" vs "focused and written" from How I Work Best (collaboration, about -1..+1), if taken. */
  collaborationVector: number | null
  dismissed: string[]
  /** The ten-dimension work profile (src/lib/profile/work-profile.ts), when loaded. */
  workProfile?: WorkProfile | null
  /** Standout strengths and weak spots (src/lib/profile/strengths.ts), when loaded. */
  strengths?: StrengthKeys | null
  /** What they want less of and more of (work-profile.ts readLikes). */
  likes?: Likes | null
}

export interface MarketStatRow {
  roleKey: string
  geo: string
  band: string
  openNow: number
  lowCompetitionOpen: number
  new30: number
  prior30: number
  new90: number
  prior90: number
  payP50: number | null
  paySample: number
}

export interface PayBenchmarkLite {
  fn: string
  seniorityGroup: string
  geo: string
  p50: number
  sampleSize: number
}

export interface MarketContext {
  stats: MarketStatRow[]
  /** WARN notices filed in the member's state in the last 90 days (all employers). */
  warn90: { filings: number; employees: number } | null
  payBenchmarks: PayBenchmarkLite[]
  payChange: PayBenchmarkRow[]
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export type FitLabel = 'Strong fit' | 'Good fit' | 'Worth exploring'

export interface Demand {
  /** Open roles in the member's state at a realistic level, plus remote roles when they'd take remote. Null without a state. */
  localOpen: number | null
  nationalOpen: number
  remoteOpen: number
  /** Plain place name for the local count ("Kentucky or remote"). */
  localLabel: string | null
  /** Change in this role's share of new postings, e.g. 0.18 = up 18%. Null until there is enough history. */
  trendPct: number | null
  trendDays: 30 | 90 | null
  trendScope: 'local' | 'national' | null
  /** Share of open roles that look low-competition (competition.ts), 0..1. */
  lowCompetitionShare: number | null
}

export interface PayChange {
  /** e.g. 0.12 = about 12% higher. Null when there's no data. */
  deltaPct: number | null
  /** Typical posted pay where they'd land, when known. */
  targetMedian: number | null
  /** What the change is measured against. */
  against: 'your target pay' | 'your current field' | null
  /** Plain sentence for the card. */
  summary: string
}

export interface PivotSuggestion {
  target: string
  label: string
  fn: string | null
  fitLabel: FitLabel
  time: TimeToPivot
  timeLabel: string
  people: PeopleContact
  highRejectionHighUpside: boolean
  why: string
  caution: string | null
  /** Skills that carry over from the member's background. */
  brings: string[]
  /** Skills already covered that the target usually needs (from the member's skills or background). */
  alreadyHave: string[]
  gaps: { label: string; way: string; example: string }[]
  demand: Demand
  pay: PayChange
  /** National long-term outlook (BLS Employment Projections and OEWS wages) when one SOC occupation stands for the role. */
  outlook: { line: string; occupation: string; medianWage: number | null; wageYear: string | null; cycle: string | null } | null
  /** Why personality moved this path, in plain words, when it did. */
  personalityNote: string | null
  /** How the role suits how the member likes to work (work profile): what matches and what clashes. */
  workFits: string[]
  workClashes: string[]
  /** "Plays to your strength" / "leans on a weak spot" lines, when known. */
  strengthPlays: string | null
  strengthExposes: string | null
  /** What the move leaves behind, still has, and gives, against what they want less and more of. */
  likesLeaves: string | null
  likesStill: string | null
  likesGains: string | null
  /** AI exposure of the role's occupation group (0-100, report data), when known. */
  ai: AiOutlook | null
  /** What O*NET says the target leans on beyond the member's starting point (shown with the O*NET credit). */
  onet: OnetGaps | null
  /** 'onet' when the path itself comes from O*NET's related occupations rather than the hand-written map. */
  origin: 'curated' | 'onet'
  /** Internal ordering only — never shown. */
  rankScore: number
}

export interface Contraction {
  contracting: boolean
  /** One line for the banner, or null when not contracting. */
  headline: string | null
  reasons: string[]
}

export interface PivotPathsResult {
  source: { key: string; label: string } | null
  contraction: Contraction
  suggestions: PivotSuggestion[]
  /** Every other path from the member's starting role, ranked, past the top suggestions. */
  more: PivotSuggestion[]
  hidden: { key: string; label: string }[]
  energy: PeopleEnergy | null
  energySource: 'answer' | 'assessment' | null
  /** False when the nightly market numbers aren't there yet; paths still show, without counts. */
  marketReady: boolean
}

// ── Level bands ─────────────────────────────────────────────────────────────

export function memberBand(highestLevelReached: string | null | undefined): Band | null {
  const l = (highestLevelReached ?? '').toLowerCase()
  if (!l.trim()) return null
  if (/c[- ]?suite|chief|vp|vice|president|exec/.test(l)) return 'EXEC'
  if (/director|head/.test(l)) return 'DIRECTOR'
  if (/manager|lead/.test(l)) return 'MANAGER'
  return 'IC'
}

function below(b: Band): Band {
  const i = BANDS.indexOf(b)
  return BANDS[Math.max(0, i - 1)]
}

/**
 * Levels a member realistically lands at on this path: keeping seniority means
 * their own level or one below; a reset means one or two below. Unknown level:
 * individual through manager.
 */
export function landingBands(band: Band | null, path: PivotEdge['path']): Band[] {
  if (!band) return ['IC', 'MANAGER']
  const set = path === 'KEEP_SENIORITY' ? [band, below(band)] : [below(band), below(below(band))]
  return [...new Set(set)]
}

/** PayBenchmark's seniority groups for a band. */
const BAND_TO_SENIORITY_GROUP: Record<Band, string> = { IC: 'SENIOR_IC', MANAGER: 'MANAGER', DIRECTOR: 'DIRECTOR', EXEC: 'VP' }

// ── Market lookups ──────────────────────────────────────────────────────────

class StatIndex {
  private m = new Map<string, MarketStatRow>()
  constructor(rows: MarketStatRow[]) {
    for (const r of rows) this.m.set(`${r.roleKey}|${r.geo}|${r.band}`, r)
  }
  get(role: string, geo: string, band: string): MarketStatRow | undefined {
    return this.m.get(`${role}|${geo}|${band}`)
  }
  sum(role: string, geo: string, bands: Band[], field: 'openNow' | 'lowCompetitionOpen' | 'new30' | 'prior30' | 'new90' | 'prior90'): number {
    let n = 0
    for (const b of bands) n += this.get(role, geo, b)?.[field] ?? 0
    return n
  }
  get size(): number {
    return this.m.size
  }
}

// History has to be comparable before a trend is shown: enough jobs in the
// earlier window overall (the board grew fast while it was being built, so a
// thin earlier window would read as everything "up"), and enough for the role.
export const TREND_MIN_PRIOR_TOTAL = 300
export const TREND_MIN_COVERAGE = 0.4
export const TREND_MIN_ROLE_PRIOR = 15

/**
 * Change in a role's share of new postings, recent window vs the one before.
 * Share, not raw counts, so growth in how many jobs we track doesn't read as
 * growth in demand. Null when the history isn't comparable.
 */
export function shareTrend(idx: StatIndex, role: string, geo: string, bands: Band[], days: 30 | 90): number | null {
  const [nf, pf] = days === 90 ? (['new90', 'prior90'] as const) : (['new30', 'prior30'] as const)
  const totalNew = idx.sum('*', geo, BANDS, nf)
  const totalPrior = idx.sum('*', geo, BANDS, pf)
  if (totalPrior < TREND_MIN_PRIOR_TOTAL || totalNew === 0 || totalPrior < TREND_MIN_COVERAGE * totalNew) return null
  const roleNew = idx.sum(role, geo, bands, nf)
  const rolePrior = idx.sum(role, geo, bands, pf)
  if (rolePrior < TREND_MIN_ROLE_PRIOR) return null
  return roleNew / totalNew / (rolePrior / totalPrior) - 1
}

export function bestTrend(idx: StatIndex, role: string, state: string | null, bands: Band[]): { pct: number; days: 30 | 90; scope: 'local' | 'national' } | null {
  for (const days of [90, 30] as const) {
    if (state) {
      const local = shareTrend(idx, role, state, bands, days)
      if (local !== null) return { pct: local, days, scope: 'local' }
    }
    const national = shareTrend(idx, role, 'US', bands, days)
    if (national !== null) return { pct: national, days, scope: 'national' }
  }
  return null
}

export function wantsRemote(remotePreference: string | null): boolean {
  return remotePreference !== 'onsite'
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'Washington, DC', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}
export function stateName(code: string): string {
  return STATE_NAMES[code] ?? code
}

export function computeDemand(idx: StatIndex, role: string, member: Pick<MemberPivotInput, 'state' | 'remotePreference'>, bands: Band[]): Demand {
  const nationalOpen = idx.sum(role, 'US', bands, 'openNow')
  const remoteOpen = idx.sum(role, 'REMOTE', bands, 'openNow')
  const remote = wantsRemote(member.remotePreference)
  const localOpen = member.state ? idx.sum(role, member.state, bands, 'openNow') + (remote ? remoteOpen : 0) : null
  const localLabel = member.state ? `${stateName(member.state)}${remote ? ' or remote' : ''}` : null
  const trend = bestTrend(idx, role, member.state, bands)
  const low = idx.sum(role, 'US', bands, 'lowCompetitionOpen')
  return {
    localOpen,
    nationalOpen,
    remoteOpen,
    localLabel,
    trendPct: trend?.pct ?? null,
    trendDays: trend?.days ?? null,
    trendScope: trend?.scope ?? null,
    lowCompetitionShare: nationalOpen > 0 ? low / nationalOpen : null,
  }
}

// Diminishing returns: the 500th open role near you matters less than the 5th.
const LOCAL_SATURATION = 300
const NATIONAL_SATURATION = 3000
function saturate(n: number, at: number): number {
  return Math.min(1, Math.log10(1 + n) / Math.log10(1 + at))
}

export function demandScore(d: Demand, openToRelocation: boolean): number {
  const national = saturate(d.nationalOpen, NATIONAL_SATURATION)
  if (d.localOpen === null) return national
  const local = saturate(d.localOpen, LOCAL_SATURATION)
  // Willing to move: the national market counts as much as the local one.
  return openToRelocation ? 0.4 * local + 0.6 * national : 0.7 * local + 0.3 * national
}

// ── Pay ─────────────────────────────────────────────────────────────────────

const STATE_PAY_MIN_SAMPLE = 15
export const PAY_DELTA_DISPLAY_CAP = 0.4
const NATIONAL_PAY_MIN_SAMPLE = 10

function rolePay(idx: StatIndex, benchmarks: PayBenchmarkLite[], role: PivotRole, band: Band, state: string | null): number | null {
  if (state) {
    const s = idx.get(role.key, state, band)
    if (s?.payP50 && s.paySample >= STATE_PAY_MIN_SAMPLE) return s.payP50
  }
  const us = idx.get(role.key, 'US', band)
  if (us?.payP50 && us.paySample >= NATIONAL_PAY_MIN_SAMPLE) return us.payP50
  if (!role.fn) return null
  const group = BAND_TO_SENIORITY_GROUP[band]
  const find = (geo: string) => benchmarks.find((b) => b.fn === role.fn && b.seniorityGroup === group && b.geo === geo)
  return (state ? find(state) : undefined)?.p50 ?? find('US')?.p50 ?? null
}

function fmtPct(p: number): string {
  return `${Math.round(Math.abs(p) * 100)}%`
}
function fmtK(n: number): string {
  return `$${Math.round(n / 1000)}k`
}

export function computePay(
  idx: StatIndex,
  ctx: Pick<MarketContext, 'payBenchmarks' | 'payChange'>,
  member: Pick<MemberPivotInput, 'targetCompMin' | 'state'>,
  source: PivotRole | null,
  target: PivotRole,
  band: Band | null,
  path: PivotEdge['path']
): PayChange {
  const landing = landingBands(band, path)[0]
  const targetMedian = rolePay(idx, ctx.payBenchmarks, target, landing, member.state)
  const ownTarget = member.targetCompMin && member.targetCompMin >= 20_000 ? member.targetCompMin : null
  const fieldPay = source && band ? rolePay(idx, ctx.payBenchmarks, source, band, member.state) : null
  const baseline = ownTarget ?? fieldPay
  const against = ownTarget ? ('your target pay' as const) : fieldPay ? ('your current field' as const) : null
  if (targetMedian && baseline) {
    const delta = targetMedian / baseline - 1
    // Posted pay leans senior (the board is mostly senior roles), so very large gaps are shown as a floor, not a precise figure.
    const dir =
      Math.abs(delta) < 0.05
        ? 'about the same as'
        : delta > PAY_DELTA_DISPLAY_CAP
          ? `more than ${fmtPct(PAY_DELTA_DISPLAY_CAP)} higher than`
          : delta < -PAY_DELTA_DISPLAY_CAP
            ? `more than ${fmtPct(PAY_DELTA_DISPLAY_CAP)} lower than`
            : `about ${fmtPct(delta)} ${delta > 0 ? 'higher' : 'lower'} than`
    return { deltaPct: delta, targetMedian, against, summary: `Typical posted pay ${fmtK(targetMedian)}, ${dir} ${against}.` }
  }
  if (targetMedian) return { deltaPct: null, targetMedian, against: null, summary: `Typical posted pay ${fmtK(targetMedian)}.` }
  if (path === 'RESET') {
    const e = estimatePayChange('RESET', ctx.payChange)
    if (e.available && e.lowPct !== null && e.highPct !== null) {
      const range = e.lowPct === e.highPct ? `about ${Math.abs(Math.round(e.lowPct))}%` : `${Math.abs(Math.round(e.highPct))}% to ${Math.abs(Math.round(e.lowPct))}%`
      return { deltaPct: null, targetMedian: null, against: null, summary: `A bigger change; published studies find pay often dips ${range} at first.` }
    }
  }
  return { deltaPct: null, targetMedian: null, against: null, summary: 'Not enough posted pay yet to compare.' }
}

// ── Personality ─────────────────────────────────────────────────────────────

/** From the assessment's collaboration dimension. Never from demographics. */
export function energyFromCollaboration(v: number | null): PeopleEnergy | null {
  if (v === null || Number.isNaN(v)) return null
  if (v >= 0.33) return 'HIGH'
  if (v <= -0.33) return 'LOW'
  return 'SOME'
}

/** Fit adjustment and the plain reason for it. */
export function personalityTilt(energy: PeopleEnergy | null, target: PivotRole): { delta: number; note: string | null } {
  if (!energy) return { delta: 0, note: null }
  if (energy === 'HIGH') {
    if (target.people === 'HIGH') {
      return target.highRejectionHighUpside
        ? { delta: 0.15, note: 'Lots of people contact and a high-rejection, high-upside role: suits someone energized by people.' }
        : { delta: 0.1, note: 'People-facing all day, which suits how you work.' }
    }
    if (target.people === 'LOW') return { delta: -0.1, note: 'Mostly focused solo work, which may drain you.' }
    return { delta: 0, note: null }
  }
  if (energy === 'LOW') {
    if (target.people === 'LOW') return { delta: 0.12, note: 'Deep, focused work with less live contact, which suits how you work.' }
    if (target.people === 'HIGH') {
      return { delta: target.highRejectionHighUpside ? -0.18 : -0.1, note: 'Heavy people contact all day; worth knowing before you commit.' }
    }
    return { delta: 0, note: null }
  }
  return target.people === 'MIXED' ? { delta: 0.05, note: 'A mix of people time and focused work.' } : { delta: 0, note: null }
}

// ── Fit ─────────────────────────────────────────────────────────────────────

const EDGE_FIT_BASE: Record<EdgeFit, number> = { close: 0.85, adjacent: 0.72, stretch: 0.58 }

const evidenceRe = new Map<string, RegExp>()
function termRe(term: string): RegExp {
  let re = evidenceRe.get(term)
  if (!re) {
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`)
    evidenceRe.set(term, re)
  }
  return re
}

/** Whether any of the member's skills (lowercased) names one of these terms as a whole word or phrase. */
export function hasEvidence(skillsLower: string[], evidence: string[]): boolean {
  return evidence.some((e) => e.trim() && skillsLower.some((s) => termRe(e).test(s)))
}

export function fitLabelFor(fit: number): FitLabel {
  if (fit >= 0.85) return 'Strong fit'
  if (fit >= 0.7) return 'Good fit'
  return 'Worth exploring'
}

// ── Contraction ─────────────────────────────────────────────────────────────

/** Contraction drop that counts: the role's share of new postings down 10% or more. */
export const CONTRACTING_TREND = -0.1

// Allowlist of source roles with structural (multi-year, sourced) decline, and
// the sourced reason. Not a blanket rule over every role with a "pressure" note.
function structuralReason(sourceKey: string): string | null {
  if (sourceKey === 'customer_service') {
    const bls = outlookForRole('customer_service')
    const projected = bls && bls.pctChange < 0 ? ` BLS projects a further ${Math.abs(bls.pctChange)}% decline from ${bls.baseYear} to ${bls.projectedYear}.` : ''
    return `Customer service jobs fell about ${Math.abs(CUSTOMER_SERVICE_TREND.employmentChangePct2025to2026)}% nationally from 2025 to 2026 (Census CPS).${projected}`
  }
  if (sourceKey === 'admin_ea') {
    const admin = OCCUPATION_TRENDS.find((r) => r.socGroup === '43')
    if (admin) return `Office and admin support has an AI task-exposure score of ${Math.round(admin.aiExposure)} out of 100, among the highest of any occupation group.`
  }
  return null
}

export function detectContraction(
  idx: StatIndex,
  source: PivotRole | null,
  member: Pick<MemberPivotInput, 'state'>,
  band: Band | null,
  warn90: MarketContext['warn90']
): Contraction {
  if (!source) return { contracting: false, headline: null, reasons: [] }
  const bands = band ? [band] : (['IC', 'MANAGER'] as Band[])
  const reasons: string[] = []
  const trend = bestTrend(idx, source.key, member.state, bands)
  const trendDown = trend !== null && trend.pct <= CONTRACTING_TREND
  if (trendDown) {
    const where = trend!.scope === 'local' && member.state ? `in ${stateName(member.state)}` : 'nationally'
    reasons.push(`${source.label} roles ${where} are down ${fmtPct(trend!.pct)} as a share of new job postings over the last ${trend!.days} days.`)
  }
  const structural = structuralReason(source.key)
  if (structural) reasons.push(structural)
  const contracting = trendDown || structural !== null
  const warnLine =
    warn90 && warn90.filings > 0 && member.state
      ? `${warn90.filings.toLocaleString()} layoff notice${warn90.filings === 1 ? ' was' : 's were'} filed in ${stateName(member.state)} in the last 90 days${warn90.employees > 0 ? `, covering ${warn90.employees.toLocaleString()} workers` : ''} (all employers).`
      : null
  if (contracting && warnLine) reasons.push(warnLine)
  if (!contracting) return { contracting: false, headline: null, reasons: [] }

  const parts: string[] = []
  if (trendDown) {
    const where = trend!.scope === 'local' ? 'in your area' : 'nationally'
    parts.push(`${source.label} roles ${where} are down ${fmtPct(trend!.pct)} in ${trend!.days} days`)
  } else {
    parts.push(`${source.label} work is shrinking`)
  }
  if (warn90 && warn90.filings > 0 && member.state) parts.push(`${warn90.filings.toLocaleString()} layoff notices were filed in ${stateName(member.state)}`)
  return { contracting: true, headline: `${parts.join(' and ')}. Here is where your skills map.`, reasons }
}

// ── Ranking ─────────────────────────────────────────────────────────────────

export const MAX_SUGGESTIONS = 5

export function rankPivots(member: MemberPivotInput, ctx: MarketContext): PivotPathsResult {
  const idx = new StatIndex(ctx.stats)
  const marketReady = idx.size > 0
  const sourceKey = detectSourceRole({ title: member.title, primaryFunction: member.primaryFunction })
  const source = sourceKey ? ROLES.get(sourceKey)! : null
  const band = memberBand(member.highestLevelReached)
  const energy = member.peopleEnergyAnswer ?? energyFromCollaboration(member.collaborationVector)
  const energySource = member.peopleEnergyAnswer ? ('answer' as const) : energy ? ('assessment' as const) : null
  const contraction = detectContraction(idx, source, member, band, ctx.warn90)
  const edges = edgesFor(sourceKey)
  const skillsLower = member.skills.map((s) => s.toLowerCase().trim()).filter(Boolean)
  const dismissed = new Set(member.dismissed)

  const scored: PivotSuggestion[] = edges.map((edge) => {
    const target = ROLES.get(edge.to)!
    const bands = landingBands(band, edge.path)
    const demand = computeDemand(idx, target.key, member, bands)
    const pay = computePay(idx, ctx, member, source, target, band, edge.path)

    const covered = new Set(edge.covers ?? [])
    const alreadyHave: string[] = []
    const gaps: PivotSuggestion['gaps'] = []
    for (const need of target.needs) {
      if (covered.has(need.key) || hasEvidence(skillsLower, need.evidence)) alreadyHave.push(need.label)
      else gaps.push({ label: need.label, way: GAP_WAY_LABEL[need.way], example: need.example })
    }
    const brings = [...edge.brings]

    const tilt = personalityTilt(energy, target)
    const wf = member.workProfile ? workFit(member.workProfile, target.key) : null
    let fit = EDGE_FIT_BASE[edge.fit]
    // How the role suits how they like to work, beyond people contact (tilt above).
    if (wf) fit += 0.12 * wf.score
    const sn = strengthNotes(member.strengths, target.key)
    fit += sn.delta
    const lf = likesFit(member.likes, sourceKey, target.key, (pay.deltaPct ?? 0) > 0.05)
    fit += lf.delta
    if (target.needs.length > 0) fit += 0.1 * (alreadyHave.length / target.needs.length)
    if (member.targetFunction && target.fn === member.targetFunction) fit += 0.08
    fit = Math.max(0, Math.min(1, fit + tilt.delta))

    const d = marketReady ? demandScore(demand, member.openToRelocation) : 0.5
    const trendMult = 1 + Math.max(-0.3, Math.min(0.3, demand.trendPct ?? 0)) * 0.5
    const payMult = 1 + Math.max(-0.3, Math.min(0.3, pay.deltaPct ?? 0)) * 0.5
    const compMult = 1 + 0.1 * (demand.lowCompetitionShare ?? 0)
    const occ = outlookForRole(target.key)
    const rankScore = fit * (0.35 + 0.65 * d * trendMult) * payMult * compMult * outlookMultiplier(occ)

    return {
      target: target.key,
      label: target.label,
      fn: target.fn,
      fitLabel: fitLabelFor(fit),
      time: edge.time,
      timeLabel: TIME_LABEL[edge.time],
      people: target.people,
      highRejectionHighUpside: !!target.highRejectionHighUpside,
      why: edge.why,
      caution: target.caution ?? null,
      brings,
      alreadyHave,
      gaps,
      demand,
      pay,
      outlook: occ ? { line: outlookLine(occ), occupation: occ.title, medianWage: occ.medianWage, wageYear: occ.wageYear, cycle: cycleLineForSoc(ROLE_SOC[target.key]) } : null,
      personalityNote: tilt.note,
      workFits: wf?.fits ?? [],
      workClashes: wf?.clashes.map((c) => c.line) ?? [],
      strengthPlays: sn.plays,
      strengthExposes: sn.exposes,
      likesLeaves: lf.leaves,
      likesStill: lf.still,
      likesGains: lf.gains,
      ai: aiOutlookForRole(target.key),
      onet: onetGaps(sourceKey, target.key, (aliases) => hasEvidence(skillsLower, aliases)),
      origin: edge.origin === 'onet' ? ('onet' as const) : ('curated' as const),
      rankScore,
    }
  })
  // Market-demand rule for O*NET's data-driven paths: not shown where the board has few such jobs.
  const all = scored.filter((s) => s.origin === 'curated' || !marketReady || s.demand.nationalOpen >= ONET_EDGE_MIN_OPEN)

  all.sort((a, b) => b.rankScore - a.rankScore || a.label.localeCompare(b.label))
  return {
    source: source ? { key: source.key, label: source.label } : null,
    contraction,
    suggestions: all.filter((s) => !dismissed.has(s.target)).slice(0, MAX_SUGGESTIONS),
    more: all.filter((s) => !dismissed.has(s.target)).slice(MAX_SUGGESTIONS),
    hidden: all.filter((s) => dismissed.has(s.target)).map((s) => ({ key: s.target, label: s.label })),
    energy,
    energySource,
    marketReady,
  }
}

/** Plain demand line for a card: "412 open roles in Kentucky or remote, up 18% in 90 days". */
export function demandLine(d: Demand): string {
  const count = d.localOpen !== null ? `${d.localOpen.toLocaleString()} open role${d.localOpen === 1 ? '' : 's'} in ${d.localLabel}` : `${d.nationalOpen.toLocaleString()} open roles nationally`
  const trend =
    d.trendPct === null || d.trendDays === null
      ? ''
      : Math.abs(d.trendPct) < 0.05
        ? `, steady over ${d.trendDays} days`
        : `, ${d.trendPct > 0 ? 'up' : 'down'} ${fmtPct(d.trendPct)} in ${d.trendDays} days${d.trendScope === 'national' ? ' nationally' : ''}`
  return `${count}${trend}`
}

/** Whether the board should offer pivot paths: the member is pivoting, or their own work is contracting. */
export function shouldOfferPivotPaths(member: { isPivoting: boolean }, contraction: Pick<Contraction, 'contracting'>): boolean {
  return member.isPivoting || contraction.contracting
}

export { StatIndex }
