// Copy for the paid-search landing page for candidates out of work for months (Google Ads, campaign 1):
//   /still-searching  out of work for months.
// (/after-a-layoff is the just-fired email form again, from 2026-11-06; see src/components/marketing/AfterLayoffForm.tsx.)
// Every claim here is already on the site (the state unemployment pages, the Market Reality Assessment, the benefits
// catalog), so nothing is promised that the product does not do. Free for Members is the site's standing line.

export type LandingPageKey = 'still_searching'

export interface LandingTile {
  title: string
  body: string
}

export interface LandingContent {
  /** The key every event carries. */
  page: LandingPageKey
  variant: 'a' | 'b'
  /** The persona whose "situation" the button stores, so onboarding's first question is already answered. */
  persona: 'laid-off' | 'searching-too-long'
  eyebrow: string
  headline: string
  subhead: string
  cta: string
  ctaNote: string
  tiles: LandingTile[]
  faq: { q: string; a: string }[]
}

const NO_RESUME = 'No résumé. No account to start.'
const FREE_NOTE = 'Free to join. Free for Members, always. About 5 minutes.'

export const STILL_SEARCHING: LandingContent = {
  page: 'still_searching',
  variant: 'a',
  persona: 'searching-too-long',
  eyebrow: 'Out of work for months?',
  headline: 'Months of applications and no interviews? Find out what is holding your search back.',
  subhead: `A five-minute assessment shows how hard this search is, which parts you control, and what to fix first. Then see the money that can pay for training, health coverage and a move. ${NO_RESUME}`,
  cta: 'Show me what is holding me back',
  ctaNote: FREE_NOTE,
  tiles: [
    { title: 'Where you stand', body: 'How hard this search will be, and which parts are in your control.' },
    { title: 'Fix what is fixable', body: 'Your résumé tested against the eleven systems that read it, each issue with its fix.' },
    { title: 'Money for the next step', body: 'Tuition and training aid, health premium help and relocation grants, ranked for you.' },
  ],
  faq: [
    {
      q: 'Why is my job search taking so long?',
      a: 'The usual causes are a résumé that does not match the roles, too few conversations with people at the employers, and applying without a referral. Fix one at a time.',
    },
    { q: 'Do I need a résumé?', a: 'No. You can start without a résumé and without an account.' },
    { q: 'Is it free?', a: 'Yes. NextChapter is free for Members, always.' },
  ],
}

/** The long-search figure: the same one and the same source as https://launchyournextchapter.com/why-stuck. */
export const LONG_SEARCH_FIGURE = {
  value: '27.1%',
  text: 'of all unemployed people had been looking for work 27 weeks or more in September 2026, up from 23.6% a year earlier.',
  source: 'NextChapter White Collar Employment Report, September 2026 (BLS Employment Situation)',
}

export const LANDING_SEO: Record<LandingPageKey, { title: string; description: string }> = {
  still_searching: {
    title: 'No interviews after months of applying? What is holding your search back',
    description: 'A five-minute assessment shows how hard your search is, which parts you control and what to fix first. Free for Members, no résumé needed.',
  },
}
