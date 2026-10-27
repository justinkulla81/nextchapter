// The figures and rules behind the COBRA vs ACA pages, in one place. Each block has the date it was read and where it
// came from; docs/COBRA_VS_ACA_SOURCES.md has the page-by-page detail. Update a block, its asOf and that doc together.
// src/test/cobra-aca.test.ts fails if a block loses its source or its date.

export const RULES_AS_OF = '2026-10-26'

export interface Sourced {
  asOf: string
  /** Where the figure was read. */
  sources: { label: string; url: string }[]
}

// ---- COBRA ------------------------------------------------------------------------------------------------------------

export const COBRA = {
  asOf: RULES_AS_OF,
  sources: [
    { label: 'DOL EBSA: COBRA continuation health coverage, FAQs for workers', url: 'http://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/resource-center/faqs/cobra-continuation-health-coverage-workers' },
    { label: 'DOL: COBRA continuation coverage (topic page)', url: 'https://www.dol.gov/general/topic/health-plans/cobra' },
  ],
  minEmployees: 20,
  electionDays: 60,
  firstPaymentDays: 45,
  maxMonthsJobLoss: 18,
  /** The most the plan may charge, as a share of the plan's cost (the whole premium plus 2 percent). */
  premiumShareOfPlanCost: 1.02,
} as const satisfies Sourced & Record<string, unknown>

// ---- Marketplace enrollment ---------------------------------------------------------------------------------------------

export const MARKETPLACE = {
  asOf: RULES_AS_OF,
  sources: [
    { label: 'HealthCare.gov: if you lose job-based coverage', url: 'https://www.healthcare.gov/have-job-based-coverage/if-you-lose-job-based-coverage/' },
    { label: 'HealthCare.gov: special enrollment period', url: 'https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/' },
    { label: 'HealthCare.gov: dates and deadlines', url: 'https://www.healthcare.gov/quick-guide/dates-and-deadlines/' },
  ],
  specialEnrollmentDays: 60,
  documentDays: 30,
  /** HealthCare.gov open enrollment for 2027 coverage: November 1 to January 15 (state-run marketplaces may differ). */
  openEnrollment2027: { start: '2026-11-01', end: '2027-01-15', januaryStartBy: '2026-12-15' },
} as const satisfies Sourced & Record<string, unknown>

// ---- Federal poverty guidelines ----------------------------------------------------------------------------------------

export type FplRegion = 'contiguous' | 'AK' | 'HI'
export interface Fpl {
  /** The guideline year. The credit for coverage in year Y uses the guidelines published for Y - 1. */
  year: 2025 | 2026
  one: Record<FplRegion, number>
  eachAdditional: Record<FplRegion, number>
}

export const FPL_SOURCES: Sourced = {
  asOf: RULES_AS_OF,
  sources: [
    { label: 'HealthCare.gov glossary: federal poverty level', url: 'https://www.healthcare.gov/glossary/federal-poverty-level-fpl/' },
    { label: 'HHS ASPE: poverty guidelines', url: 'https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines' },
    { label: 'Federal Register 2025-01377: 2025 HHS poverty guidelines', url: 'https://www.federalregister.gov/documents/2025/01/17/2025-01377/annual-update-of-the-hhs-poverty-guidelines' },
  ],
}

export const FPL: Record<2025 | 2026, Fpl> = {
  2025: { year: 2025, one: { contiguous: 15_650, AK: 19_550, HI: 17_990 }, eachAdditional: { contiguous: 5_500, AK: 6_880, HI: 6_330 } },
  2026: { year: 2026, one: { contiguous: 15_960, AK: 19_950, HI: 18_360 }, eachAdditional: { contiguous: 5_680, AK: 7_100, HI: 6_530 } },
}

// ---- Premium tax credit -------------------------------------------------------------------------------------------------

export interface PtcBand {
  /** Income from this share of the poverty line (inclusive)... */
  fromFpl: number
  /** ...up to this (exclusive, except the last band which is inclusive at 400). */
  toFpl: number
  /** Share of income the person is expected to pay for the benchmark plan at the bottom and the top of the band. */
  initial: number
  final: number
}

export interface PtcYear extends Sourced {
  /** Coverage year the table is for. */
  coverageYear: 2026 | 2027
  /** The poverty guidelines it uses: the most recent published when open enrollment begins (the year before). */
  fplYear: 2025 | 2026
  bands: PtcBand[]
  /** The affordability line for employer coverage, from the same revenue procedure. */
  requiredContribution: number
  /** No credit above this share of the poverty line. */
  capFpl: 400
}

const band = (fromFpl: number, toFpl: number, initial: number, final: number): PtcBand => ({ fromFpl, toFpl, initial, final })

export const PTC: Record<2026 | 2027, PtcYear> = {
  2026: {
    coverageYear: 2026,
    fplYear: 2025,
    asOf: RULES_AS_OF,
    sources: [{ label: 'IRS Rev. Proc. 2025-25, section 3.01', url: 'https://www.irs.gov/pub/irs-drop/rp-25-25.pdf' }],
    bands: [band(0, 133, 0.021, 0.021), band(133, 150, 0.0314, 0.0419), band(150, 200, 0.0419, 0.066), band(200, 250, 0.066, 0.0844), band(250, 300, 0.0844, 0.0996), band(300, 400, 0.0996, 0.0996)],
    requiredContribution: 0.0996,
    capFpl: 400,
  },
  2027: {
    coverageYear: 2027,
    fplYear: 2026,
    asOf: RULES_AS_OF,
    sources: [{ label: 'IRS Rev. Proc. 2026-26, sections 3.01 and 3.02', url: 'https://www.irs.gov/pub/irs-drop/rp-26-26.pdf' }],
    bands: [band(0, 133, 0.0215, 0.0215), band(133, 150, 0.0323, 0.043), band(150, 200, 0.043, 0.0678), band(200, 250, 0.0678, 0.0866), band(250, 300, 0.0866, 0.1022), band(300, 400, 0.1022, 0.1022)],
    requiredContribution: 0.1022,
    capFpl: 400,
  },
}

export const PTC_RULE_SOURCES: Sourced = {
  asOf: RULES_AS_OF,
  sources: [
    { label: 'IRS: Questions and answers on the Premium Tax Credit', url: 'https://www.irs.gov/affordable-care-act/individuals-and-families/questions-and-answers-on-the-premium-tax-credit' },
    { label: 'IRS Tax Topic 418: unemployment compensation', url: 'https://www.irs.gov/taxtopics/tc418' },
  ],
}

// ---- Medicaid -----------------------------------------------------------------------------------------------------------

export const MEDICAID = {
  asOf: RULES_AS_OF,
  sources: [
    { label: 'KFF: status of state Medicaid expansion decisions (October 2026)', url: 'https://www.kff.org/medicaid/status-of-state-medicaid-expansion-decisions/' },
    { label: 'KFF: how many uninsured are in the coverage gap', url: 'https://www.kff.org/medicaid/how-many-uninsured-are-in-the-coverage-gap-and-how-many-could-be-eligible-if-all-states-adopted-the-medicaid-expansion/' },
    { label: 'HealthCare.gov: Medicaid expansion and you', url: 'https://www.healthcare.gov/medicaid-chip/medicaid-expansion-and-you/' },
  ],
  /** Adults 19 to 64 in an expansion state qualify up to this share of the poverty line, tested on monthly income. */
  expansionFplPercent: 138,
  creditsStartFplPercent: 100,
} as const satisfies Sourced & Record<string, unknown>

export const STATE_TABLE_SOURCES: Sourced = {
  asOf: RULES_AS_OF,
  sources: [
    { label: 'KFF: marketplace average monthly benchmark premiums', url: 'https://www.kff.org/affordable-care-act/state-indicator/marketplace-average-benchmark-premiums/' },
    { label: 'KFF: state health insurance marketplace types', url: 'https://www.kff.org/affordable-care-act/state-indicator/state-health-insurance-marketplace-types/' },
    { label: 'NAIC: state insurance departments', url: 'https://content.naic.org/state-insurance-departments' },
    { label: 'HealthCare.gov: marketplace in your state', url: 'https://www.healthcare.gov/marketplace-in-your-state/' },
  ],
}

export const NATIONAL_BENCHMARK = { 2025: 497, 2026: 625 } as const
