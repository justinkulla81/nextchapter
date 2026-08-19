// Synthetic (not-a-real-candidate) data shaped exactly like WhereYouStand
// (src/lib/reports/market-reality-sections.ts) — Partners Master Build
// Script §C3.1 ("proof of the diagnosis... an anonymized sample Market
// Reality Report. Real output beats any description.") and §C3.2 ("every
// landing page needs one concrete real artifact"). This feeds
// SampleMarketRealityReport with the same decomposition-tile shape a real
// candidate sees on their own Market Reality Report and Stats pages, just
// with invented numbers for a fictional "Jordan M."

export const SAMPLE_CANDIDATE_LABEL = 'Jordan M., VP Operations (sample)'

export const SAMPLE_MARKET_REALITY_PROPS = {
  grade: 'C' as const,
  strongestLine: 'Your Experience is a B — that part is working.',
  constraintLine:
    "Your Resume is a D, and it's the thing holding your grade down — three roles show only responsibilities, not outcomes, so a recruiter skimming for 6 seconds can't see the results behind the titles.",
  decomposition: [
    {
      label: 'Experience',
      grade: 'B' as const,
      control: 'High' as const,
      note: 'How your career record reads — fully in your control, days to weeks to fix.',
    },
    {
      label: 'Resume',
      grade: 'D' as const,
      control: 'High' as const,
      note: 'How your resume document itself reads — fully in your control, days to weeks to fix.',
    },
    {
      label: 'How many roles exist',
      grade: 'B' as const,
      control: 'None' as const,
      note: 'Level, function, and geography — scarcity rises with seniority.',
    },
  ],
}
