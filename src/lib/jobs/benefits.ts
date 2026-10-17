// Structured job benefits, as the ncrawl import sends them (CSV column
// benefits_json → import field `benefitsJson`): compact JSON with only the keys
// the crawler found in the posting, plus its own `score` (categories present)
// and `strong` flag. Pure, no I/O — the import stores what parseBenefits keeps,
// and the board's "Great benefits" filter and "Strong benefits" badge use
// isStrongBenefits.

export interface JobBenefits {
  health?: boolean
  dental?: boolean
  vision?: boolean
  k401?: boolean
  /** Employer 401(k) match, percent of pay (6 = 6%). */
  k401_match_pct?: number
  pension?: boolean
  parental_leave?: boolean
  parental_leave_weeks?: number
  pto?: boolean
  pto_days?: number
  pto_unlimited?: boolean
  tuition?: boolean
  childcare?: boolean
  remote_stipend?: boolean
  equity?: boolean
  espp?: boolean
  sabbatical?: boolean
  /** The crawler's count of benefit categories present. */
  score?: number
  /** The crawler's own "strong" verdict. */
  strong?: boolean
}

const BOOL_KEYS = [
  'health', 'dental', 'vision', 'k401', 'pension', 'parental_leave', 'pto', 'pto_unlimited',
  'tuition', 'childcare', 'remote_stipend', 'equity', 'espp', 'sabbatical', 'strong',
] as const
const NUMBER_KEYS = ['k401_match_pct', 'parental_leave_weeks', 'pto_days', 'score'] as const

// Plausible ranges; anything outside is a parse error upstream, not a benefit.
const NUMBER_MAX: Record<(typeof NUMBER_KEYS)[number], number> = {
  k401_match_pct: 100,
  parental_leave_weeks: 104,
  pto_days: 365,
  score: 50,
}

/** Benefit categories counted when the crawler sent no score. */
const CATEGORY_KEYS = [
  'health', 'dental', 'vision', 'k401', 'pension', 'parental_leave', 'pto', 'tuition',
  'childcare', 'remote_stipend', 'equity', 'espp', 'sabbatical',
] as const

function asBool(v: unknown): boolean | undefined {
  if (v === true || v === 1 || v === '1' || v === 'true') return true
  if (v === false || v === 0 || v === '0' || v === 'false') return false
  return undefined
}

function asNumber(v: unknown, max: number): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max ? n : undefined
}

/**
 * The known keys of a benefits payload (a JSON string or an object), typed and
 * range-checked, in a fixed key order; null when nothing usable is left.
 * Unknown keys are dropped, so a newer crawler can't grow the stored object.
 */
export function parseBenefits(raw: unknown): JobBenefits | null {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return null
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const src = obj as Record<string, unknown>
  const out: JobBenefits = {}
  for (const k of BOOL_KEYS) {
    const b = asBool(src[k])
    if (b !== undefined) out[k] = b
  }
  for (const k of NUMBER_KEYS) {
    const n = asNumber(src[k], NUMBER_MAX[k])
    if (n !== undefined) out[k] = k === 'k401_match_pct' ? n : Math.round(n)
  }
  // Fixed order, so the same payload always stores (and compares) the same.
  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k as keyof JobBenefits]])) as JobBenefits
  return Object.keys(sorted).length > 0 ? sorted : null
}

/** Categories present: the crawler's score, or a count of the categories it marked. */
export function benefitsScore(b: JobBenefits): number {
  if (typeof b.score === 'number') return b.score
  return CATEGORY_KEYS.filter((k) => b[k] === true).length
}

/**
 * Strong benefits, per job: the crawler says so, or six or more benefit
 * categories, or three or more with at least one standout — a 401(k) match of
 * 6%+, 16+ weeks of parental leave, a pension, a sabbatical, childcare or
 * unlimited PTO.
 */
export function isStrongBenefits(b: JobBenefits | null | undefined): boolean {
  if (!b) return false
  if (b.strong === true) return true
  const score = benefitsScore(b)
  if (score >= 6) return true
  if (score < 3) return false
  return (
    (b.k401_match_pct ?? 0) >= 6 ||
    (b.parental_leave_weeks ?? 0) >= 16 ||
    b.pension === true ||
    b.sabbatical === true ||
    b.childcare === true ||
    b.pto_unlimited === true
  )
}

/** Short plain labels for what the posting offers, standouts first. */
export function benefitsHighlights(b: JobBenefits | null | undefined): string[] {
  if (!b) return []
  const out: string[] = []
  if (b.k401_match_pct) out.push(`${b.k401_match_pct}% 401(k) match`)
  else if (b.k401) out.push('401(k)')
  if (b.pension) out.push('Pension')
  if (b.parental_leave_weeks) out.push(`${b.parental_leave_weeks} weeks parental leave`)
  else if (b.parental_leave) out.push('Paid parental leave')
  if (b.pto_unlimited) out.push('Unlimited PTO')
  else if (b.pto_days) out.push(`${b.pto_days} days PTO`)
  else if (b.pto) out.push('Paid time off')
  const medical = (['health', 'dental', 'vision'] as const).filter((k) => b[k])
  if (medical.length > 0) out.push(medical.length === 3 ? 'Health, dental, vision' : medical.map((k, i) => (i === 0 ? k[0].toUpperCase() + k.slice(1) : k)).join(', '))
  if (b.childcare) out.push('Childcare support')
  if (b.tuition) out.push('Tuition help')
  if (b.sabbatical) out.push('Sabbatical')
  if (b.espp) out.push('Stock purchase plan')
  if (b.equity) out.push('Equity')
  if (b.remote_stipend) out.push('Remote work stipend')
  return out
}

/**
 * The import's benefits fields for one job: {} when the sender sent neither
 * (an older exporter — stored values stay as they are), otherwise the parsed
 * payload (null when empty or unreadable) and our strong verdict. The sender's
 * own benefits_strong counts as the crawler's strong flag.
 */
export function importBenefitsFields(job: { benefitsJson?: unknown; benefitsStrong?: unknown }): { benefits?: JobBenefits | null; benefitsStrong?: boolean | null } {
  const hasJson = 'benefitsJson' in job && job.benefitsJson !== undefined
  const hasStrong = 'benefitsStrong' in job && job.benefitsStrong !== undefined && job.benefitsStrong !== null
  if (!hasJson && !hasStrong) return {}
  const parsed = hasJson ? parseBenefits(job.benefitsJson) : null
  const senderStrong = hasStrong ? asBool(job.benefitsStrong) === true : false
  const benefits = senderStrong && parsed?.strong !== true ? parseBenefits({ ...parsed, strong: true }) : parsed
  return { benefits, benefitsStrong: benefits ? isStrongBenefits(benefits) : false }
}
