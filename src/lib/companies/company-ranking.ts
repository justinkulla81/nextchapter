import type { CompanySizeBand } from '@prisma/client'
import { calibratedLevelRank } from '@/lib/scoring/level-rank'

// "Best companies for you" — the pure scoring half of the ranked company
// directory (the Prisma-backed loader is company-ranking-data.ts). No I/O
// here, so every weight below is unit-testable (src/test/company-ranking.test.ts).
//
// Eight positive components (max 100 together) plus two penalties. Every
// component returns BOTH points and, when it earned them, a plain-English
// reason — the directory shows the reasons, never the number alone, so a
// ranking is always explainable ("why is this #2?").
//
// Missing data is neutral, never a guess: a company with no industry/size
// resolved yet (those are lazily LLM-resolved only when someone opens the
// company page — see resolveCompanyMetadataIfMissing — and deliberately not
// resolved for the whole directory) gets a mid-low partial credit and no
// reason, so it can neither win nor lose on a fact we don't have.
//
// Privacy contract for the recruiter signal: postings whose source can't be
// shown to this candidate (confidential disclosure, EXCLUDED distribution, or
// Candidate+-only when the viewer isn't Candidate+) arrive as an anonymous
// COUNT (hiddenPostings). They add a small capped boost to the
// hiring component and nothing else — no reason text, no badge, no title, no
// recruiter name — so a ranking can never reveal which company a
// confidential search is for. Public mandates arrive as named postings.

export const LEVELS = ['IC', 'Manager', 'Director', 'VP', 'C-Suite'] as const

const BAND_ORDER: CompanySizeBand[] = ['MICRO', 'SMALL', 'SMALL_MID', 'MID', 'MID_LARGE', 'LARGE', 'ENTERPRISE', 'MEGA']

// Midpoint headcount per band, for turning "N employees affected by a layoff
// notice" into a share of the company. Bands are ranges, so this is a coarse
// estimate — it only scales a penalty, it is never shown as a number.
const BAND_MIDPOINT: Record<CompanySizeBand, number> = {
  MICRO: 5,
  SMALL: 30,
  SMALL_MID: 125,
  MID: 600,
  MID_LARGE: 3000,
  LARGE: 12000,
  ENTERPRISE: 60000,
  MEGA: 200000,
}

export interface RankingCandidate {
  primaryFunction: string | null
  secondaryFunction: string | null
  highestLevelReached: string | null
  levelRankScore: number | null
  metroArea: string | null
  openToRelocation: boolean
  remotePreference: string | null // 'remote' | 'hybrid' | 'onsite' | 'flexible'
  // industryContext + secondaryIndustryContext + targetIndustries, flattened
  industries: string[]
  targetCompanySize: string | null // 'Any' | '1-50' | '50-500' | '500+'
  // 0 = local economy fine, 1 = elevated strain, 2 = high (see local-economy.ts)
  localStress: 0 | 1 | 2
}

export interface NamedPosting {
  title: string
  function: string | null
  level: string // one of LEVELS, from the title
  metro: string | null // normalizeMetroArea of the posting's city, null if unknown/unmapped
  isRemote: boolean
  isRecruiterMandate: boolean // public recruiter-led search, company named
}

export interface RankingCompany {
  id: string
  name: string
  canonicalNameNormalized: string
  industry: string | null
  sizeBand: CompanySizeBand | null
  hqMetro: string | null
  trajectory: 'growing' | 'flat' | 'contracting' | null
  // null when the latest weekly signal is stale (>8 wks) or absent
  postings: NamedPosting[]
  // Open-role count from the company's fresh weekly CompanySignal, or null
  // when there is none. The signal counts every live posting (including ones
  // this viewer can't see by name), and the directory has always shown that
  // count to every member, so using it adds no new exposure — and it keeps a
  // non-Candidate+ member's ranking from collapsing to a tie.
  signalOpenRoles: number | null
  // ms timestamp of the newest posting this viewer can see by name; drives "new".
  latestPostingAt: number | null
  // Year-over-year change in national employment for this company's industry
  // (BLS), or null when its industry is unknown / has no BLS sector.
  industryYoyPct: number | null
  hiddenPostings: number
  warn: { filings12mo: number; employeesAffected: number; daysSinceMostRecent: number } | null
  myContactCount: number
  memberFormerCount: number // NC members who worked here (insider-eligible only)
  memberSameFunctionCount: number
  onWatchlist: boolean
}

export interface ScoreComponent {
  key: string
  label: string
  points: number
  max: number
  reason: string | null
}

export type FitBand = 'strong' | 'worth_a_look' | 'long_shot'

export interface Adjustment {
  key: string
  points: number // signed
  note: string
}

export interface CompanyRanking {
  score: number // 0-100
  band: FitBand
  components: ScoreComponent[]
  adjustments: Adjustment[]
  reasons: string[] // top positive reasons, best first
  cautions: string[]
  competition: 'lower' | 'moderate' | 'higher' | 'unknown'
  hasHiringData: boolean
}

const MAX = { hiring: 25, gap: 20, local: 15, network: 15, industry: 10, size: 10, competition: 5 } as const
// hiring 25 + gap 20 + local 15 + network 15 + industry 10 + size 10 + competition 5 = 100

const levelIndex = (level: string | null): number => (level ? (LEVELS as readonly string[]).indexOf(level) : -1)
const bandIndex = (band: CompanySizeBand): number => BAND_ORDER.indexOf(band)

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// ── industry ──────────────────────────────────────────────────────────────

function industryTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !['services', 'industry', 'company', 'other', 'and'].includes(t))
}

export function industriesOverlap(a: string, b: string): boolean {
  const x = a.toLowerCase().trim()
  const y = b.toLowerCase().trim()
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  // "Health care" vs "Healthcare": same word, different spacing.
  const cx = x.replace(/[^a-z0-9]/g, '')
  const cy = y.replace(/[^a-z0-9]/g, '')
  if (cx.length >= 5 && cy.length >= 5 && (cx.includes(cy) || cy.includes(cx))) return true
  const tb = new Set(industryTokens(y))
  return industryTokens(x).some((t) => tb.has(t))
}

function scoreIndustry(company: RankingCompany, candidate: RankingCandidate): ScoreComponent {
  const base = { key: 'industry', label: 'Industry fit', max: MAX.industry }
  if (!company.industry || candidate.industries.length === 0) return { ...base, points: 4, reason: null }
  const match = candidate.industries.some((i) => industriesOverlap(i, company.industry!))
  return match
    ? { ...base, points: MAX.industry, reason: `In your industry (${company.industry})` }
    : { ...base, points: 0, reason: null }
}

// ── size ──────────────────────────────────────────────────────────────────

// targetCompanySize options are 'Any' | '1-50' | '50-500' | '500+'. Bands and
// those buckets don't line up exactly, so partial credit for the band that
// straddles a boundary (MID is 201-1,000: mostly "50-500", partly "500+").
const SIZE_FIT: Record<string, Partial<Record<CompanySizeBand, number>>> = {
  '1-50': { MICRO: 10, SMALL: 10, SMALL_MID: 4 },
  '50-500': { SMALL: 4, SMALL_MID: 10, MID: 7 },
  '500+': { MID: 4, MID_LARGE: 10, LARGE: 10, ENTERPRISE: 10, MEGA: 10 },
}

function scoreSize(company: RankingCompany, candidate: RankingCandidate): ScoreComponent {
  const base = { key: 'size', label: 'Size fit', max: MAX.size }
  if (!company.sizeBand) return { ...base, points: 4, reason: null }
  const target = candidate.targetCompanySize
  if (!target || target === 'Any' || !SIZE_FIT[target]) return { ...base, points: 6, reason: null }
  const points = SIZE_FIT[target][company.sizeBand] ?? 0
  return { ...base, points, reason: points >= 10 ? `Right size for you (${target} employees)` : null }
}

// ── hiring ────────────────────────────────────────────────────────────────

function scoreHiring(company: RankingCompany): { component: ScoreComponent; hasData: boolean } {
  const base = { key: 'hiring', label: 'Hiring momentum', max: MAX.hiring }
  const trajectoryPoints = company.trajectory === 'growing' ? 15 : company.trajectory === 'flat' ? 8 : company.trajectory === 'contracting' ? 0 : 4
  const open = Math.max(company.postings.length, company.signalOpenRoles ?? 0)
  const openPoints = Math.min(6, open * 2)
  // Anonymous recruiter-search boost: capped at 4 and never explained, see the
  // privacy contract in this file's header. Only applied when there is no
  // fresh weekly signal — the signal already counts these postings, so adding
  // both would double-count them.
  const hiddenPoints = company.signalOpenRoles === null ? Math.min(4, company.hiddenPostings * 2) : 0
  const points = Math.min(MAX.hiring, trajectoryPoints + openPoints + hiddenPoints)
  const mandates = company.postings.filter((p) => p.isRecruiterMandate).length

  let reason: string | null = null
  if (mandates > 0) reason = `Recruiter-led search open now (exclusive to NextChapter)`
  else if (company.trajectory === 'growing' && open > 0) reason = `Hiring and growing — ${plural(open, 'open role')}`
  else if (company.trajectory === 'growing') reason = 'Posting more roles than a quarter ago'
  else if (open > 0) reason = `${plural(open, 'open role')} right now`

  return {
    component: { ...base, points, reason },
    hasData: company.trajectory !== null || open > 0 || company.hiddenPostings > 0,
  }
}

// ── role gap ("they're hiring what you do") ───────────────────────────────

// We cannot see a company's org chart, so "they don't have someone with your
// experience" is approximated by the only real evidence we hold: they are
// currently posting a role in your function at/near your level. Labelled that
// way in the UI — never claimed as knowledge of their staffing.
function scoreGap(company: RankingCompany, candidate: RankingCandidate): ScoreComponent {
  const base = { key: 'gap', label: 'Role in your function', max: MAX.gap }
  if (company.postings.length === 0) return { ...base, points: 0, reason: null }

  const myLevel = levelIndex(candidate.highestLevelReached)
  let best = 0
  let bestTitle: string | null = null
  for (const p of company.postings) {
    let pts = 0
    if (p.function && p.function === candidate.primaryFunction) pts = 12
    else if (p.function && p.function === candidate.secondaryFunction) pts = 6
    else pts = 1
    if (pts > 1 && myLevel >= 0) {
      const dist = Math.abs(levelIndex(p.level) - myLevel)
      pts += dist === 0 ? 8 : dist === 1 ? 5 : dist === 2 ? 1 : 0
    }
    if (pts > best) {
      best = pts
      bestTitle = p.title
    }
  }
  const reason = best >= 12 && bestTitle ? `Hiring in your function: ${bestTitle}` : null
  return { ...base, points: Math.min(MAX.gap, best), reason }
}

// ── local ─────────────────────────────────────────────────────────────────

function isLocalTo(company: RankingCompany, candidate: RankingCandidate): boolean {
  if (!candidate.metroArea) return false
  return company.hqMetro === candidate.metroArea || company.postings.some((p) => p.metro === candidate.metroArea)
}

function scoreLocal(company: RankingCompany, candidate: RankingCandidate): ScoreComponent {
  const base = { key: 'local', label: 'Local to you', max: MAX.local }
  if (!candidate.metroArea) return { ...base, points: 6, reason: null }

  const metros = new Set<string>()
  if (company.hqMetro) metros.add(company.hqMetro)
  for (const p of company.postings) if (p.metro) metros.add(p.metro)

  if (metros.has(candidate.metroArea)) return { ...base, points: MAX.local, reason: `Local — hiring in ${candidate.metroArea}` }
  const remoteOk = candidate.remotePreference === 'remote' || candidate.remotePreference === 'flexible' || candidate.remotePreference === 'hybrid'
  if (remoteOk && company.postings.some((p) => p.isRemote)) return { ...base, points: 8, reason: 'Has remote roles' }
  if (metros.size === 0) return { ...base, points: 4, reason: null }
  return { ...base, points: candidate.openToRelocation ? 4 : 0, reason: null }
}

// ── network ───────────────────────────────────────────────────────────────

function scoreNetwork(company: RankingCompany): ScoreComponent {
  const base = { key: 'network', label: 'Ways in', max: MAX.network }
  const c = company.myContactCount
  const contactPts = c >= 5 ? 11 : c >= 2 ? 9 : c === 1 ? 6 : 0
  const memberPts = company.memberFormerCount >= 5 ? 4 : company.memberFormerCount >= 1 ? 2 : 0
  const points = Math.min(MAX.network, contactPts + memberPts)

  let reason: string | null = null
  if (c > 0) reason = `You know ${plural(c, 'person', 'people')} here`
  else if (company.memberFormerCount >= 5) reason = 'Several NextChapter members have worked here and can answer questions'
  else if (company.memberFormerCount >= 1) reason = 'A NextChapter member has worked here'
  return { ...base, points, reason }
}

// ── competition ───────────────────────────────────────────────────────────

function competitionOf(band: CompanySizeBand | null): CompanyRanking['competition'] {
  if (!band) return 'unknown'
  const i = bandIndex(band)
  if (i >= bandIndex('LARGE')) return 'higher'
  if (i >= bandIndex('MID_LARGE')) return 'moderate'
  return i >= bandIndex('SMALL_MID') ? 'moderate' : 'lower'
}

function scoreCompetition(company: RankingCompany): { component: ScoreComponent; level: CompanyRanking['competition'] } {
  const base = { key: 'competition', label: 'Competition', max: MAX.competition }
  const level = competitionOf(company.sizeBand)
  const band = company.sizeBand
  const points = !band ? 3 : bandIndex(band) <= bandIndex('SMALL') ? 5 : bandIndex(band) <= bandIndex('MID') ? 4 : bandIndex(band) === bandIndex('MID_LARGE') ? 2 : 1
  return {
    component: { ...base, points, reason: level === 'lower' ? 'Smaller applicant pool than a big-name employer' : null },
    level,
  }
}

// ── penalties ─────────────────────────────────────────────────────────────

function layoffPenalty(company: RankingCompany): { points: number; caution: string | null } {
  const w = company.warn
  if (!w || w.filings12mo === 0) return { points: 0, caution: null }
  const share = company.sizeBand && w.employeesAffected > 0 ? w.employeesAffected / BAND_MIDPOINT[company.sizeBand] : 0.1
  const raw = 8 + Math.min(17, share * 40)
  const recency = w.daysSinceMostRecent <= 90 ? 1 : w.daysSinceMostRecent <= 180 ? 0.7 : 0.4
  const points = Math.round(Math.min(25, raw * recency))
  const when = w.daysSinceMostRecent <= 45 ? 'in the last 45 days' : w.daysSinceMostRecent <= 180 ? 'in the last 6 months' : 'in the last year'
  return { points, caution: `Layoff notice filed ${when}` }
}

// The overhire read: how much more senior the candidate is than the most
// senior role this company can plausibly hire at its size. A big title at a
// small company is exactly where "will they stay / can we afford them" gets
// asked. Level scores are size-calibrated (level-rank.ts), so the same title
// compares correctly across a 10-person and a 10,000-person company.
function overhirePenalty(company: RankingCompany, candidate: RankingCandidate): { points: number; caution: string | null } {
  const mine = candidate.levelRankScore ?? calibratedLevelRank(candidate.highestLevelReached, null)
  if (mine === null || !company.sizeBand) return { points: 0, caution: null }
  const ceilingFromPostings = company.postings.map((p) => calibratedLevelRank(p.level, company.sizeBand)).filter((n): n is number => n !== null)
  // With no posting to anchor on, assume the practical external-hire ceiling
  // is VP-equivalent at this company's size.
  const ceiling = ceilingFromPostings.length > 0 ? Math.max(...ceilingFromPostings) : (calibratedLevelRank('VP', company.sizeBand) ?? 70)
  const gap = mine - ceiling
  if (gap < 10) return { points: 0, caution: null }
  const points = Math.min(10, Math.round((gap - 5) / 2))
  return { points, caution: 'You may read as overqualified here — address it directly' }
}

// ── market adjustments (small, signed, outside the 100) ───────────────────

// Is the company's industry adding or shedding jobs nationally? Capped at +-3
// and silent under half a percent: a 0.3% wobble is not a signal.
export function industryTrendAdjustment(yoyPct: number | null): Adjustment | null {
  if (yoyPct === null || Math.abs(yoyPct) < 0.5) return null
  const points = Math.round(Math.max(-1, Math.min(1, yoyPct / 2)) * 3)
  if (points === 0) return null
  const pct = `${yoyPct > 0 ? '+' : '−'}${Math.abs(yoyPct).toFixed(1)}%`
  return {
    key: 'industry_trend',
    points,
    note: points > 0 ? `Its industry is adding jobs nationally (${pct} over the last year)` : `Its industry is shedding jobs nationally (${pct} over the last year)`,
  }
}

// When the member's own area is under strain (rising unemployment, a heavy run
// of local layoffs), a local opening is contested by more displaced workers.
// Applies only to companies actually hiring in the member's metro.
export function localStrainAdjustment(company: RankingCompany, candidate: RankingCandidate): Adjustment | null {
  if (candidate.localStress === 0 || !isLocalTo(company, candidate)) return null
  return {
    key: 'local_strain',
    points: -candidate.localStress,
    note: 'Your local job market is under strain — expect more competition for local roles',
  }
}

// ── total ─────────────────────────────────────────────────────────────────

export function bandFor(score: number): FitBand {
  return score >= 65 ? 'strong' : score >= 45 ? 'worth_a_look' : 'long_shot'
}

export function scoreCompany(company: RankingCompany, candidate: RankingCandidate): CompanyRanking {
  const hiring = scoreHiring(company)
  const competition = scoreCompetition(company)
  const components: ScoreComponent[] = [
    hiring.component,
    scoreGap(company, candidate),
    scoreLocal(company, candidate),
    scoreNetwork(company),
    scoreIndustry(company, candidate),
    scoreSize(company, candidate),
    competition.component,
  ]

  const layoff = layoffPenalty(company)
  const overhire = overhirePenalty(company, candidate)
  const adjustments = [industryTrendAdjustment(company.industryYoyPct), localStrainAdjustment(company, candidate)].filter(
    (a): a is Adjustment => a !== null
  )
  const positive = components.reduce((s, c) => s + c.points, 0)
  const adjusted = adjustments.reduce((sum, a) => sum + a.points, 0)
  const score = Math.max(0, Math.min(100, Math.round(positive + adjusted - layoff.points - overhire.points)))

  const cautions: string[] = []
  if (layoff.caution) cautions.push(layoff.caution)
  if (company.trajectory === 'contracting') cautions.push('Posting fewer roles than a quarter ago')
  if (overhire.caution) cautions.push(overhire.caution)
  for (const a of adjustments) if (a.points < 0) cautions.push(a.note)
  if (company.sizeBand && bandIndex(company.sizeBand) >= bandIndex('LARGE') && competition.level === 'higher') {
    cautions.push('Large employer — expect heavy competition')
  }

  // Best reasons = highest share of each component's ceiling, so a perfect
  // 10/10 industry match outranks a 6/25 hiring mention. Two reasons are
  // pinned first regardless of share, because they're the ones a candidate
  // can act on today: someone they know there, and an exclusive recruiter
  // search.
  const hasMandate = company.postings.some((p) => p.isRecruiterMandate)
  const pinned = (c: ScoreComponent) => (c.key === 'network' && company.myContactCount > 0) || (c.key === 'hiring' && hasMandate)
  const reasons = components
    .filter((c) => c.reason && c.points > 0)
    .sort((a, b) => Number(pinned(b)) - Number(pinned(a)) || b.points / b.max - a.points / a.max)
    .slice(0, 4)
    .map((c) => c.reason!)
  const trend = adjustments.find((a) => a.key === 'industry_trend' && a.points > 0)
  if (trend && reasons.length < 4) reasons.push(trend.note)

  return {
    score,
    band: bandFor(score),
    components,
    adjustments,
    reasons,
    cautions,
    competition: competition.level,
    hasHiringData: hiring.hasData,
  }
}

export interface RankedCompany {
  company: RankingCompany
  ranking: CompanyRanking
}

// Highest score first; ties go to the company with real hiring data, then A-Z,
// so the order is stable between page loads.
export function rankCompanies(companies: RankingCompany[], candidate: RankingCandidate): RankedCompany[] {
  return companies
    .map((company) => ({ company, ranking: scoreCompany(company, candidate) }))
    .sort(
      (a, b) =>
        b.ranking.score - a.ranking.score ||
        Number(b.ranking.hasHiringData) - Number(a.ranking.hasHiringData) ||
        a.company.name.localeCompare(b.company.name)
    )
}
