// The figures and rules behind the severance pages and the severance calculator, in one place. Each block has the date it was read
// and where it came from; docs/PATTERN_UNEMPLOYMENT_SEVERANCE.md has the claim-by-claim detail. Update a block, its asOf and that doc
// together. src/test/severance-rules.test.ts fails if a block loses its source or its date.
//
// How each state treats severance for unemployment is not here: it lives in src/lib/data/state-ui.ts, generated from the Department
// of Labor tables and the state agencies, each fact with its own URL and date.

export const SEVERANCE_RULES_AS_OF = '2026-10-27'

export interface Sourced {
  asOf: string
  /** Where the figure was read. */
  sources: { label: string; url: string }[]
}

// ---- No federal requirement -------------------------------------------------------------------------------------------

export const NO_FEDERAL_RULE = {
  asOf: SEVERANCE_RULES_AS_OF,
  sources: [{ label: 'DOL: Severance Pay', url: 'https://www.dol.gov/general/topic/wages/severancepay' }],
} as const satisfies Sourced

// ---- Federal withholding and payroll taxes ------------------------------------------------------------------------------

export const WITHHOLDING = {
  asOf: SEVERANCE_RULES_AS_OF,
  sources: [
    { label: 'IRS Publication 15 (2026), Circular E', url: 'https://www.irs.gov/publications/p15' },
    { label: 'IRS Topic 560: Additional Medicare Tax', url: 'https://www.irs.gov/taxtopics/tc560' },
  ],
  taxYear: 2026,
  /** Flat rate an employer may withhold on supplemental wages (severance is supplemental wages) when it uses the flat-rate method. */
  supplementalRate: 0.22,
  /** Mandatory rate on supplemental wages paid to an employee over $1 million in the calendar year, on the part over it. */
  supplementalRateOver: 0.37,
  supplementalThreshold: 1_000_000,
  socialSecurityRate: 0.062,
  /** The 2026 Social Security wage base: earnings above this in the year are not subject to the 6.2%. */
  socialSecurityWageBase: 184_500,
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  /** An employer withholds the additional Medicare tax on wages over this in a calendar year, whatever the filing status. */
  additionalMedicareThreshold: 200_000,
} as const satisfies Sourced & Record<string, unknown>

// ---- Reviewing and signing a severance agreement ------------------------------------------------------------------------

export const WAIVER = {
  asOf: SEVERANCE_RULES_AS_OF,
  sources: [
    {
      label: 'EEOC: Understanding Waivers of Discrimination Claims in Employee Severance Agreements (Q&A)',
      url: 'https://www.eeoc.gov/laws/guidance/qa-understanding-waivers-discrimination-claims-employee-severance-agreements',
    },
  ],
  /** Applies to employees 40 and older (Older Workers Benefit Protection Act). */
  minAge: 40,
  /** Days to consider an individual offer, counted from the employer's final offer. */
  considerDays: 21,
  /** Days to consider an offer made in a group exit incentive or termination program. */
  considerDaysGroup: 45,
  /** Days to revoke after signing; the agreement is not effective until they pass. */
  revokeDays: 7,
} as const satisfies Sourced & Record<string, unknown>

// ---- WARN Act ----------------------------------------------------------------------------------------------------------

export const WARN = {
  asOf: SEVERANCE_RULES_AS_OF,
  sources: [
    { label: '29 U.S.C. 2101: WARN definitions', url: 'https://www.law.cornell.edu/uscode/text/29/2101' },
    { label: '29 U.S.C. 2102: WARN notice', url: 'https://www.law.cornell.edu/uscode/text/29/2102' },
    { label: '29 U.S.C. 2104: WARN liability', url: 'https://www.law.cornell.edu/uscode/text/29/2104' },
  ],
  noticeDays: 60,
  /** Employers with at least this many employees, not counting part-time employees. */
  minEmployees: 100,
  /** A plant closing: employment loss for at least this many employees at a single site in a 30-day period. */
  plantClosingEmployees: 50,
  /** A mass layoff: at least 33% of employees and at least this many, or at least `massLayoffAlways` employees. */
  massLayoffEmployees: 50,
  massLayoffShare: 0.33,
  massLayoffAlways: 500,
  /** An employer that violates WARN owes back pay and benefits for each day of violation, up to this many days. */
  maxBackPayDays: 60,
} as const satisfies Sourced & Record<string, unknown>

// ---- How much severance is typical ------------------------------------------------------------------------------------

export const SURVEYS = {
  asOf: SEVERANCE_RULES_AS_OF,
  sources: [
    {
      label: 'ASE: 2024 Severance Pay, Policies, & Practices Survey (125 Michigan organizations)',
      url: 'https://www.aseonline.org/News-Events/Articles/ase-releases-results-to-the-2024-severance-pay-policies-practices-survey',
    },
    { label: 'Challenger, Gray & Christmas: 2025 Severance & Salary Benchmarking Report', url: 'https://www.challengergray.com/?p=27543' },
  ],
  /** ASE, 2024 survey of 125 Michigan employers: the share that use each formula. Michigan only; not a national figure. */
  oneWeekPerYearShare: 0.57,
  twoWeeksPerYearShare: 0.24,
  /** Challenger, Gray & Christmas, data for 2024: the average total severance in weeks, and the year before. A total, not a rate per year. */
  averageTotalWeeks: 19.3,
  priorAverageTotalWeeks: 15.6,
  individualContributorWeeksUnder: 10,
} as const satisfies Sourced & Record<string, unknown>

export const UNEMPLOYMENT_TAX = {
  asOf: SEVERANCE_RULES_AS_OF,
  sources: [{ label: 'IRS Topic 418: Unemployment compensation', url: 'https://www.irs.gov/taxtopics/tc418' }],
} as const satisfies Sourced

/** Every block, for the Sources section and the test. */
export const SEVERANCE_SOURCE_BLOCKS: { title: string; block: Sourced }[] = [
  { title: 'Federal law on severance', block: NO_FEDERAL_RULE },
  { title: 'Withholding and payroll taxes', block: WITHHOLDING },
  { title: 'Reviewing and signing an agreement', block: WAIVER },
  { title: 'WARN Act notice', block: WARN },
  { title: 'How much severance is typical', block: SURVEYS },
  { title: 'Unemployment benefits are taxable', block: UNEMPLOYMENT_TAX },
]
