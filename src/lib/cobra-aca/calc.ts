import { COBRA, FPL, MARKETPLACE, MEDICAID, PTC, type FplRegion } from '@/lib/cobra-aca/rules'
import { FPL_REGION, STATE_FACTS } from '@/lib/cobra-aca/states'

// The math behind the cost-compare tool and the worked examples on the state pages. Pure, no I/O. Rules and figures:
// src/lib/cobra-aca/rules.ts (IRS Rev. Proc. 2025-25 and 2026-26, HHS poverty guidelines). It is an ESTIMATE: inside a band
// the expected-contribution percentage is moved in a straight line from the band's start to its end. IRS Form 8962
// (Table 2) lists the exact figure for each whole percent of the poverty line and is what a tax return uses.

export type CoverageYear = 2026 | 2027

/** The poverty guideline for a household, using the guidelines that apply to coverage in `coverageYear`. */
export function fplAmount(coverageYear: CoverageYear, householdSize: number, region: FplRegion = 'contiguous'): number {
  const g = FPL[PTC[coverageYear].fplYear]
  const size = Math.max(1, Math.floor(householdSize))
  return g.one[region] + (size - 1) * g.eachAdditional[region]
}

/**
 * The guideline Medicaid uses: the current year's. HealthCare.gov: "2026 income is used to check if you're eligible for Medicaid", while the
 * credit uses the guidelines published the year before. 2027 Medicaid guidelines are not out yet, so 2027 coverage uses the latest (2026).
 */
export function medicaidFplAmount(householdSize: number, region: FplRegion = 'contiguous'): number {
  const g = FPL[2026]
  return g.one[region] + (Math.max(1, Math.floor(householdSize)) - 1) * g.eachAdditional[region]
}

/** Household income as a percent of the poverty line. */
export function fplPercent(income: number, coverageYear: CoverageYear, householdSize: number, region: FplRegion = 'contiguous'): number {
  return (income / fplAmount(coverageYear, householdSize, region)) * 100
}

/** The share of income expected for the benchmark plan at this income, or null above 400% of the poverty line (no credit). */
export function applicablePercent(coverageYear: CoverageYear, fplPct: number): number | null {
  const t = PTC[coverageYear]
  if (fplPct > t.capFpl) return null
  const b = t.bands.find((x, i) => fplPct < x.toFpl || i === t.bands.length - 1)!
  if (b.initial === b.final) return b.initial
  const share = Math.min(1, Math.max(0, (fplPct - b.fromFpl) / (b.toFpl - b.fromFpl)))
  return b.initial + share * (b.final - b.initial)
}

export interface CompareInput {
  coverageYear: CoverageYear
  state: string
  householdSize: number
  /** Expected household income for the coverage year, dollars (include pay already earned, severance and unemployment). */
  annualIncome: number
  /** What COBRA would cost per month for the coverage they want. */
  cobraMonthly: number
  /** A quoted Marketplace premium per month, before credits, for the plan they would pick. Blank = use the state's benchmark. */
  marketplaceMonthly?: number | null
}

export type Eligibility = 'medicaid' | 'gap' | 'credit' | 'no-credit'

export interface CompareResult {
  fplAmount: number
  fplPct: number
  eligibility: Eligibility
  /** Premium used for the Marketplace plan, before the credit, and where it came from. */
  marketplaceMonthly: number
  marketplaceSource: 'quote' | 'state-benchmark'
  /** Credit per month on the benchmark plan, 0 when none. */
  creditMonthly: number
  /** What the person pays per month for that plan after the credit. */
  marketplaceAfterCreditMonthly: number
  /** What the credit is expected to leave them paying, as a share of income. */
  expectedShareOfIncome: number | null
  cobraMonthly: number
  /** COBRA minus the Marketplace plan after the credit: positive means the Marketplace plan costs less each month. */
  monthlyDifference: number
  /** Income at which the credit ends (400% of the poverty line) and how far the person is from it. */
  cliffIncome: number
  headroomToCliff: number
}

/** Medicaid is tested on monthly income, so a person whose annual figure is under the line may qualify in an expansion state. */
export function compare(input: CompareInput): CompareResult {
  const region = FPL_REGION(input.state)
  const facts = STATE_FACTS[input.state]
  const fpl = fplAmount(input.coverageYear, input.householdSize, region)
  const pct = (input.annualIncome / fpl) * 100
  const medicaidPct = (input.annualIncome / medicaidFplAmount(input.householdSize, region)) * 100
  const useQuote = typeof input.marketplaceMonthly === 'number' && input.marketplaceMonthly > 0
  const marketplaceMonthly = useQuote ? (input.marketplaceMonthly as number) : facts.benchmark[2026]
  const share = applicablePercent(input.coverageYear, pct)

  let eligibility: Eligibility
  if (facts.medicaidExpansion && medicaidPct <= MEDICAID.expansionFplPercent) eligibility = 'medicaid'
  else if (!facts.medicaidExpansion && pct < MEDICAID.creditsStartFplPercent && !facts.waiverToFpl100) eligibility = 'gap'
  else if (!facts.medicaidExpansion && pct < MEDICAID.creditsStartFplPercent) eligibility = 'medicaid'
  else if (share === null) eligibility = 'no-credit'
  else eligibility = 'credit'

  const contributionMonthly = share === null ? null : (share * input.annualIncome) / 12
  const creditMonthly = eligibility === 'credit' && contributionMonthly !== null ? Math.max(0, marketplaceMonthly - contributionMonthly) : 0
  const afterCredit = Math.max(0, marketplaceMonthly - creditMonthly)
  const cliffIncome = fpl * (PTC[input.coverageYear].capFpl / 100)

  return {
    fplAmount: fpl,
    fplPct: pct,
    eligibility,
    marketplaceMonthly,
    marketplaceSource: useQuote ? 'quote' : 'state-benchmark',
    creditMonthly,
    marketplaceAfterCreditMonthly: afterCredit,
    expectedShareOfIncome: share,
    cobraMonthly: input.cobraMonthly,
    monthlyDifference: input.cobraMonthly - afterCredit,
    cliffIncome,
    headroomToCliff: cliffIncome - input.annualIncome,
  }
}

/**
 * The credit a single adult loses by earning one dollar over 400% of the poverty line: the benchmark plan's price minus the expected
 * contribution at exactly 400%. It is 0 when the benchmark is cheaper than that contribution.
 */
export function creditAtCliff(coverageYear: CoverageYear, state: string, householdSize = 1): { income: number; creditMonthly: number } {
  const region = FPL_REGION(state)
  const income = fplAmount(coverageYear, householdSize, region) * (PTC[coverageYear].capFpl / 100)
  const share = applicablePercent(coverageYear, PTC[coverageYear].capFpl) ?? 0
  const contributionMonthly = (share * income) / 12
  return { income, creditMonthly: Math.max(0, STATE_FACTS[state].benchmark[2026] - contributionMonthly) }
}

// ---- Dates ----------------------------------------------------------------------------------------------------------------

const DAY_MS = 86_400_000
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS)

/** First day of the month after `d` (UTC). */
export function firstOfNextMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
}

export interface Deadlines {
  coverageEnds: Date
  /** Last day to elect COBRA: 60 days from the later of the coverage end and the notice date. */
  cobraElectBy: Date
  /** Latest first payment if the person elects on the last day: 45 days after the election. */
  cobraFirstPaymentBy: Date
  /** Last day to enroll through the Marketplace special enrollment period: 60 days after coverage ends. */
  marketplaceBy: Date
  /** Start of the Marketplace plan if it is picked before coverage ends, and if it is picked on the last day. */
  marketplaceStartIfPickedBefore: Date
  marketplaceStartIfPickedLastDay: Date
  /** Latest open-enrollment dates for 2027 coverage on HealthCare.gov (if the special enrollment window has passed). */
  openEnrollmentEnds: Date
}

/** Dates counted from the day job-based coverage ends. `noticeDate` is when the COBRA election notice arrived, if later. */
export function deadlines(coverageEnds: Date, noticeDate?: Date | null): Deadlines {
  const base = noticeDate && noticeDate.getTime() > coverageEnds.getTime() ? noticeDate : coverageEnds
  const cobraElectBy = addDays(base, COBRA.electionDays)
  const marketplaceBy = addDays(coverageEnds, MARKETPLACE.specialEnrollmentDays)
  return {
    coverageEnds,
    cobraElectBy,
    cobraFirstPaymentBy: addDays(cobraElectBy, COBRA.firstPaymentDays),
    marketplaceBy,
    marketplaceStartIfPickedBefore: firstOfNextMonth(coverageEnds),
    marketplaceStartIfPickedLastDay: firstOfNextMonth(marketplaceBy),
    openEnrollmentEnds: new Date(`${MARKETPLACE.openEnrollment2027.end}T00:00:00Z`),
  }
}

export const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`
