// Synthetic Executive Dossier content for the /dossier marketing page —
// Partners Master Build Script §C3.3 ("the whole product in one page. Show
// a real Dossier."). The live DossierSectionsView component
// (src/components/dashboard/DossierSections.tsx) is fed by a heavy,
// server-only builder (dossier-sections.ts) that pulls live candidate rows
// across a dozen tables — not practical or appropriate to fake for public
// display. Instead this mirrors the REAL section id/title/order the product
// actually ships (see SECTION_TITLES / SECTION_ORDER in
// src/lib/reports/dossier-sections.ts) with fully invented content for a
// fictional candidate, so the page shows the real shape of the product
// without exposing real candidate data.
export interface SampleDossierSection {
  id: string
  title: string
  body: string
}

export const SAMPLE_DOSSIER_CANDIDATE = 'Jordan M.'
export const SAMPLE_DOSSIER_ROLE = 'VP Operations, enterprise SaaS'

export const SAMPLE_DOSSIER_SECTIONS: SampleDossierSection[] = [
  {
    id: 'positioning',
    title: 'Positioning Statement',
    body: 'An operations leader who scales process without slowing teams down — built for a Series C-to-IPO stage where the systems that got a company to $50M stop working at $200M.',
  },
  {
    id: 'howIOperate',
    title: 'How I Operate',
    body: 'Direct, structured, decisive under ambiguity. References independently describe the same pattern: sets a clear bar, gives people room to hit it, steps in early when something is off track rather than after it breaks.',
  },
  {
    id: 'impactOnPeople',
    title: 'Impact on People',
    body: '"I\'d hire Jordan again without hesitation — the team trusted the direction because Jordan was straight with them, even when the news was bad." — Former direct report, 2 years',
  },
  {
    id: 'selfAwareness',
    title: 'Self-Awareness',
    body: 'Rated own delegation as a growth area before references were asked — references independently confirmed the same read. Matches, not a self-serving gap.',
  },
  {
    id: 'learningGrowth',
    title: 'Learning & Growth Trajectory',
    body: 'Completed a Kellogg exec-ed Corporate Finance certificate (sourced through the NextChapter Alumni Benefits Network) during the search — logged as evidence of effort, not scored as a competency.',
  },
  {
    id: 'fit',
    title: 'Fit — Where I Do My Best Work',
    body: 'High-growth, process-immature environments where the mandate is "build the system," not maintain one already built. Explicitly not a fit for steady-state operations roles.',
  },
  {
    id: 'proofPoints',
    title: 'Proof-Point Narratives',
    body: 'Rebuilt the S&OP process across 3 business units after a acquisition-driven headcount doubling — cut planning cycle time from 6 weeks to 9 days, corroborated by two references who lived through it.',
  },
]

export const SAMPLE_DOSSIER_REFERENCES_AVAILABLE = 3
export const SAMPLE_DOSSIER_REFERENCES_TOTAL = 5
