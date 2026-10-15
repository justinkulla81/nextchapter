// Work types on the one job board: what kind of engagement a job is, how it pays,
// and which types a member sees by default. Pure — no database — so the rules are
// unit-tested (src/test/work-type.test.ts).
//
// A job's type comes from the crawler's normalized employment type when the import
// sent one (ExclusiveJobPosting.employmentType), otherwise from its title (and
// description, when we hold one). No AI, no per-view cost. Anything we can't tell
// is full-time, since that is what almost every board job is.

export const WORK_TYPES = ['full_time', 'part_time', 'contract', 'advisory'] as const
export type WorkType = (typeof WORK_TYPES)[number]

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time & fractional',
  contract: 'Contract & 1099',
  advisory: 'Advisory & board',
}

/** Short label for a job card chip. */
export const WORK_TYPE_CHIP: Record<WorkType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  advisory: 'Advisory / board',
}

export function isWorkType(v: unknown): v is WorkType {
  return typeof v === 'string' && (WORK_TYPES as readonly string[]).includes(v)
}

// The crawler's employment_type_norm values (ncrawl/derive.py norm_employment_type),
// plus 'advisory' / 'board' for a sender that classifies those itself.
const EMPLOYMENT_TYPE_TO_WORK_TYPE: Record<string, WorkType> = {
  full_time: 'full_time',
  part_time: 'part_time',
  fractional: 'part_time',
  per_diem: 'part_time',
  interim: 'contract',
  contract: 'contract',
  temporary: 'contract',
  internship: 'contract',
  advisory: 'advisory',
  board: 'advisory',
}

/** Board, advisory and trustee seats — never "Financial Advisor", which is a full-time job. */
const ADVISORY_TITLE =
  /\b(board (member|director|seat|chair|advisor|trustee)|independent director|non[- ]executive director|board of (directors|trustees)|advisory (board|council|committee)|\btrustee\b|board observer)/i
const INTERN_TITLE = /\bintern(ship)?\b/i
const FRACTIONAL_TITLE = /\b(fractional|part[- ]time|per diem|prn)\b/i
const INTERIM_TITLE = /\binterim\b/i
// "Contract Manager" and "Contract Specialist" are full-time jobs about contracts; the
// word only means the engagement when it is set apart: "(Contract)", "- Contract",
// "12 month contract", "Contract-to-hire", "Contract -", "Contractor", "freelance", "1099".
const CONTRACT_TITLE =
  /(\(\s*(cw|contract[^)]*|contractor|temp|temporary|freelance|1099)\s*\)|[-–—|,:]\s*contract(or)?\b(?!\s+(manager|specialist|administrat|analyst|negotiat|compliance|manufactur|logistics|management|officer|lead|director|attorney|counsel))|^\s*contract(or)?\s*[-–—:]|\b\d+\s*(-\s*)?(month|mo|week|wk)s?\s+(fixed[- ]term\s+)?contract\b|\bfixed[- ]term\b|\bcontract[- ]to[- ]hire\b|\bc2h\b|\bcontractor\b|\bfreelance\b|\b1099\b|\btemporary\b)/i
const DESC_CONTRACT = /\b(this is a|is a|an?) (\d+[- ]month )?(contract|contract-to-hire|temporary|1099) (role|position|assignment|engagement|opportunity)/i
const DESC_PART_TIME = /\b(part[- ]time|fractional) (role|position|engagement|opportunity)\b|\b\d{1,2}\s*(-\s*\d{1,2}\s*)?hours (per|a) week\b/i

export interface WorkTypeInput {
  title: string
  description?: string | null
  /** ExclusiveJobPosting.employmentType from the crawler, when sent. */
  employmentType?: string | null
}

/** Which of the four board types a job is. */
export function classifyWorkType(input: WorkTypeInput): WorkType {
  const sent = input.employmentType?.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (sent && EMPLOYMENT_TYPE_TO_WORK_TYPE[sent]) {
    // The crawler can't see board seats; a board title wins over its "full_time".
    if (EMPLOYMENT_TYPE_TO_WORK_TYPE[sent] === 'full_time' && ADVISORY_TITLE.test(input.title)) return 'advisory'
    return EMPLOYMENT_TYPE_TO_WORK_TYPE[sent]
  }
  const t = input.title
  if (INTERN_TITLE.test(t)) return 'contract'
  if (ADVISORY_TITLE.test(t)) return 'advisory'
  if (FRACTIONAL_TITLE.test(t)) return 'part_time'
  if (INTERIM_TITLE.test(t) || CONTRACT_TITLE.test(t)) return 'contract'
  const d = (input.description ?? '').slice(0, 3000)
  if (d) {
    if (DESC_CONTRACT.test(d)) return 'contract'
    if (DESC_PART_TIME.test(d)) return 'part_time'
  }
  return 'full_time'
}

// ── compensation ─────────────────────────────────────────────────────────

export type CompensationKind = 'paid' | 'equity_only' | 'unpaid'

// "Volunteer Board Member" is unpaid; "Director of Volunteer Programs" is a paid job.
const UNPAID_TITLE = /(^\s*volunteer\b|\bvolunteer (board|position|role|advisor|director|member|trustee|seat)|\b(unpaid|uncompensated|pro bono)\b)/i
// Descriptions only count when they say the role itself is unpaid — an executive job
// that "works with a volunteer board" is paid.
const UNPAID_TEXT =
  /\b(this (is an?|position is an?|role is an?) (unpaid|volunteer)|unpaid (position|role|board|opportunity|seat)|volunteer (position|role|opportunity)|(position|role|seat) is (unpaid|uncompensated|a volunteer)|serves? without compensation|receive no compensation|pro bono (position|role))\b/i
const EQUITY_ONLY_TEXT = /\b(equity[- ]only|sweat equity|compensat\w* (is |will be )?(solely |entirely )?(in )?equity)\b/i

/** Unpaid, equity-only or paid (the default). The crawler's/admin's own value wins. */
export function compensationKind(input: { title: string; description?: string | null; compensationType?: string | null }): CompensationKind {
  const sent = input.compensationType?.trim().toLowerCase()
  if (sent === 'unpaid' || sent === 'equity_only' || sent === 'paid') return sent
  const text = `${input.title}\n${(input.description ?? '').slice(0, 3000)}`
  if (UNPAID_TITLE.test(input.title)) return 'unpaid'
  if (EQUITY_ONLY_TEXT.test(text)) return 'equity_only'
  if (UNPAID_TEXT.test(text)) return 'unpaid'
  return 'paid'
}

export type PayPeriod = 'year' | 'month' | 'week' | 'day' | 'hour' | 'project'

const PERIOD_ALIASES: Record<string, PayPeriod> = {
  year: 'year', yearly: 'year', annual: 'year', annually: 'year',
  month: 'month', monthly: 'month',
  week: 'week', weekly: 'week', biweek: 'week',
  day: 'day', daily: 'day',
  hour: 'hour', hourly: 'hour',
  one_time: 'project', project: 'project', fixed: 'project',
}

/**
 * The period a posted amount is per: the import's own value when it sent one,
 * otherwise read from the amount the same way annualizePay does (under $300 is
 * hourly, $1,500–$25,000 monthly, anything larger yearly).
 */
export function payPeriodOf(input: { salaryMin?: number | null; salaryMax?: number | null; payPeriod?: string | null }): PayPeriod | null {
  const sent = input.payPeriod?.trim().toLowerCase()
  if (sent && PERIOD_ALIASES[sent]) return PERIOD_ALIASES[sent]
  const hi = input.salaryMax || input.salaryMin
  if (!hi || hi <= 0) return null
  if (hi < 300) return 'hour'
  if (hi >= 1_500 && hi <= 25_000) return 'month'
  if (hi < 1_500) return 'day'
  return 'year'
}

function money(n: number, period: PayPeriod): string {
  if (period === 'hour' || n < 1_000) return `$${Math.round(n).toLocaleString('en-US')}`
  const k = n / 1000
  return `$${Number.isInteger(k) || k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`
}

const PERIOD_SUFFIX: Record<PayPeriod, string> = {
  year: '/yr',
  month: '/mo',
  week: '/wk',
  day: '/day',
  hour: '/hr',
  project: ' per project',
}

/**
 * How a job pays, in one short label: "$150k/yr", "$150k–$180k/yr", "$175/hr",
 * "$5k/mo retainer", "Equity only", "Unpaid". Null when no pay is posted.
 */
export function payBasisLabel(input: {
  title: string
  description?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  payPeriod?: string | null
  compensationType?: string | null
  workType?: WorkType
}): string | null {
  const kind = compensationKind(input)
  if (kind === 'unpaid') return 'Unpaid'
  if (kind === 'equity_only') return 'Equity only'
  const lo = input.salaryMin && input.salaryMin > 0 ? input.salaryMin : null
  const hi = input.salaryMax && input.salaryMax > 0 ? input.salaryMax : null
  if (lo === null && hi === null) return null
  const period = payPeriodOf(input)
  if (!period) return null
  const currency = input.salaryCurrency && input.salaryCurrency.toUpperCase() !== 'USD' ? `${input.salaryCurrency.toUpperCase()} ` : ''
  const a = Math.min(lo ?? hi!, hi ?? lo!)
  const b = Math.max(lo ?? hi!, hi ?? lo!)
  const range = a === b ? money(a, period) : `${money(a, period)}–${money(b, period)}`
  const retainer = period === 'month' && (input.workType === 'part_time' || input.workType === 'advisory') ? ' retainer' : ''
  return `${currency}${range}${PERIOD_SUFFIX[period]}${retainer}`
}

/**
 * Market-pay comparisons are built from full-time salaries, so only a paid
 * full-time job is compared. Hourly full-time pay is compared hourly (the
 * market range divided by 2,080 hours); contract, part-time, advisory and unpaid
 * jobs are not compared at all.
 */
export type PayComparison = { compare: false; reason: string } | { compare: true; basis: 'year' | 'hour' }

export function payComparison(workType: WorkType, kind: CompensationKind, period: PayPeriod | null): PayComparison {
  if (kind !== 'paid') return { compare: false, reason: kind === 'unpaid' ? 'Unpaid role' : 'Paid in equity' }
  if (workType !== 'full_time') return { compare: false, reason: `${WORK_TYPE_CHIP[workType]} pay isn't compared with full-time salaries` }
  return { compare: true, basis: period === 'hour' ? 'hour' : 'year' }
}

export const HOURS_PER_YEAR = 2080

/** "$72–$96/hr" from an annual market range, for comparing an hourly job. */
export function hourlyMarketRange(low: number, high: number): string {
  return `$${Math.round(low / HOURS_PER_YEAR)}–$${Math.round(high / HOURS_PER_YEAR)}/hr`
}

// ── which types a member sees ────────────────────────────────────────────

export interface WorkTypeDefaultsInput {
  /** Saved choice (CandidateProfile.jobBoardWorkTypes); empty means "never chosen". */
  jobBoardWorkTypes?: string[] | null
  journey?: string | null
  /** Search Strategy: "open to fractional/interim consulting while searching". */
  interimConsultingInterest?: boolean | null
  /** Search Strategy / Interim Work: "willing to take board positions". */
  boardAdvisoryWillingness?: boolean | null
  /** Answered the Interim Work directory question (target rate / openness). */
  gigDirectoryUnlockAnswer?: string | null
  /** ParallelPath.paths: what the member does alongside the search (see parallel-path-fit.ts). */
  parallelPaths?: string[] | null
}

/** ParallelPath.paths that mean "I take flexible, non-permanent work". Training is not one: it says what the member is busy with, not what work they want. */
const FLEXIBLE_WORK_PATHS = ['CONTRACT_1099', 'FRACTIONAL', 'CONSULTING', 'OWN_BUSINESS', 'PART_TIME']

/** Work types a member's parallel paths make worth showing by default (see parallel-path-fit.ts). */
export function pathWorkTypes(paths: readonly string[] | null | undefined): WorkType[] {
  return (paths ?? []).some((p) => FLEXIBLE_WORK_PATHS.includes(p)) ? ['part_time', 'contract'] : []
}

/**
 * The member's own saved choice when they have one; otherwise from what they told
 * us: everyone gets full-time, except a "next act" journey (board, fractional,
 * consulting, part-time — explicitly not full-time ladder jobs); part-time and
 * contract are added for anyone open to interim/fractional work; advisory and
 * board for anyone willing to take board seats.
 */
export function defaultWorkTypes(p: WorkTypeDefaultsInput): WorkType[] {
  const saved = (p.jobBoardWorkTypes ?? []).filter(isWorkType)
  if (saved.length > 0) return WORK_TYPES.filter((t) => saved.includes(t))
  if (p.journey === 'NEXT_ACT') return ['part_time', 'contract', 'advisory']
  const out = new Set<WorkType>(['full_time'])
  if (p.interimConsultingInterest || p.gigDirectoryUnlockAnswer) {
    out.add('part_time')
    out.add('contract')
  }
  for (const t of pathWorkTypes(p.parallelPaths)) out.add(t)
  if (p.boardAdvisoryWillingness === true) out.add('advisory')
  return WORK_TYPES.filter((t) => out.has(t))
}

/** `types` URL parameter ("full_time,contract") → types, or null when absent/invalid. */
export function parseWorkTypesParam(raw: string | string[] | null | undefined): WorkType[] | null {
  const s = Array.isArray(raw) ? raw.join(',') : raw
  if (!s) return null
  const picked = s.split(',').map((x) => x.trim()).filter(isWorkType)
  return picked.length > 0 ? WORK_TYPES.filter((t) => picked.includes(t)) : null
}

export function workTypesParam(types: readonly WorkType[]): string {
  return WORK_TYPES.filter((t) => types.includes(t)).join(',')
}

/** RoleProfile types (employer-posted matched roles) → board work type. */
export function roleProfileWorkType(type: string): WorkType {
  if (type.startsWith('BOARD')) return 'advisory'
  if (type.startsWith('CONSULTING')) return 'contract'
  return 'full_time'
}
