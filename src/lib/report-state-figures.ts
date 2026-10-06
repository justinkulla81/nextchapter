// State figures published in the latest Displacement Report edition, for the
// /layoffs/[state] pages. The report names only the leaders and laggards, so
// most states have no entry: the page then says so and links to BLS rather
// than filling the gap with an estimate.
//
// Source for the September 2026 edition: Chapter 08 and Exhibit 15, from BLS
// State Employment and Unemployment, August 2026 (released Sep 18, 2026).
// Replace this block with each new edition.

export interface StateFigures {
  /** Over-the-year payroll change, seasonally adjusted. */
  payrollChange?: { jobs: number; pct: number; significant: boolean }
  /** Unemployment rate, %, seasonally adjusted. */
  unemploymentRate?: number
}

export const STATE_FIGURES_EDITION = {
  slug: 'displacement-report-september-2026',
  month: 'August 2026',
  period: 'August 2025 to August 2026',
  source: 'BLS State Employment and Unemployment, August 2026 (Sep 18, 2026)',
  blsUrl: 'https://www.bls.gov/news.release/laus.nr0.htm',
}

export const STATE_FIGURES: Record<string, StateFigures> = {
  SC: { payrollChange: { jobs: 38_600, pct: 1.6, significant: true } },
  NM: { payrollChange: { jobs: 14_500, pct: 1.6, significant: true } },
  LA: { payrollChange: { jobs: 32_100, pct: 1.6, significant: true } },
  MN: { payrollChange: { jobs: 43_900, pct: 1.5, significant: true } },
  NC: { payrollChange: { jobs: 65_600, pct: 1.3, significant: true } },
  TX: { payrollChange: { jobs: 159_400, pct: 1.1, significant: true } },
  DC: { payrollChange: { jobs: -27_000, pct: -3.6, significant: true }, unemploymentRate: 5.7 },
  MT: { payrollChange: { jobs: -5_000, pct: -0.9, significant: false } },
  VA: { payrollChange: { jobs: -37_700, pct: -0.9, significant: false } },
  OR: { payrollChange: { jobs: -16_100, pct: -0.8, significant: false }, unemploymentRate: 5.1 },
  IN: { payrollChange: { jobs: -16_100, pct: -0.5, significant: false } },
  NJ: { payrollChange: { jobs: -9_900, pct: -0.2, significant: false } },
  CA: { unemploymentRate: 5.1 },
  CT: { unemploymentRate: 5.1 },
  MI: { unemploymentRate: 5.0 },
  SD: { unemploymentRate: 2.0 },
  ND: { unemploymentRate: 2.2 },
  OH: { unemploymentRate: 3.3 },
}
