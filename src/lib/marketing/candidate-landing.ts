// Copy for the paid-search landing pages for candidates (Google Ads, campaign 1). Three pages, two audiences:
//   /after-a-layoff   laid off in the last few weeks. Two versions are tested against each other (src/lib/after-layoff-ab.ts):
//                     A leads with the plan, B leads with the money. Everything below the opening is identical.
//   /still-searching  out of work for months. Not part of the test: a different person with a different question.
// Every claim here is already on the site (the state unemployment pages, the Market Reality Assessment, the benefits
// catalog), so nothing is promised that the product does not do. Free for Members is the site's standing line.

export type LandingPageKey = 'after_a_layoff' | 'still_searching'

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
  /** After-a-layoff pages show the state picker and the clocks; the long-search page shows the long-search figure. */
  extras: 'clocks' | 'long_search'
}

const NO_RESUME = 'No résumé. No account to start.'
const FREE_NOTE = 'Free to join. Free for Members, always. About 5 minutes.'

const AFTER_LAYOFF_TILES: LandingTile[] = [
  { title: 'This week', body: 'File for unemployment in your state, and know what to ask about severance and health coverage.' },
  { title: 'Money you may be owed', body: 'Health premium help, tuition aid, relocation grants and tax credits, ranked for you.' },
  { title: 'Jobs worth your time', body: 'Professional roles checked open, with local ones on top.' },
]

const AFTER_LAYOFF_FAQ: LandingContent['faq'] = [
  { q: 'Is it free?', a: 'Yes. NextChapter is free for Members, always.' },
  { q: 'Do I need a résumé?', a: 'No. You can start without a résumé and without an account.' },
  { q: 'Where do the program amounts come from?', a: 'Each program links to its official page and says when we last checked it against that page.' },
]

export const AFTER_LAYOFF_A: LandingContent = {
  page: 'after_a_layoff',
  variant: 'a',
  persona: 'laid-off',
  eyebrow: 'Laid off, or about to be?',
  headline: 'Laid off? Here is what to do this week, and the money you may be owed.',
  subhead: `Answer a few questions. Get a plan for unemployment, severance, health coverage and your job search, plus the programs you may qualify for out of more than 3,000 we track. ${NO_RESUME}`,
  cta: 'Get my layoff plan',
  ctaNote: FREE_NOTE,
  tiles: AFTER_LAYOFF_TILES,
  faq: AFTER_LAYOFF_FAQ,
  extras: 'clocks',
}

export const AFTER_LAYOFF_B: LandingContent = {
  ...AFTER_LAYOFF_A,
  variant: 'b',
  headline: 'Find the money you may be owed after a layoff. It takes five minutes.',
  subhead: `Answer a few questions and see which of more than 3,000 benefit and aid programs you may qualify for, ranked for you. You also get a plan for unemployment, severance, health coverage and your job search. ${NO_RESUME}`,
  cta: 'See what I qualify for',
}

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
  extras: 'long_search',
}

/** What to do when you lose a job, in the order the clocks start. The same four lines as the state unemployment pages. */
export const LAYOFF_CLOCKS: LandingTile[] = [
  { title: 'This week: file for unemployment', body: 'Most states pay only from the week you file, even if you got severance.' },
  {
    title: 'Before you sign a severance agreement',
    body: 'If you are 40 or older, a release of age-discrimination claims must give you at least 21 days to consider it (45 days if it is part of a group layoff program) and 7 days to change your mind after you sign.',
  },
  { title: 'Within 60 days: choose health coverage', body: 'You have 60 days to elect COBRA and 60 days to join a Marketplace plan.' },
  { title: 'Check whether you were owed notice', body: 'Employers with 100 or more employees must give 60 days’ written notice of a plant closing or mass layoff.' },
]

/** The long-search figure: the same one and the same source as https://launchyournextchapter.com/why-stuck. */
export const LONG_SEARCH_FIGURE = {
  value: '27.1%',
  text: 'of all unemployed people had been looking for work 27 weeks or more in September 2026, up from 23.6% a year earlier.',
  source: 'NextChapter White Collar Employment Report, September 2026 (BLS Employment Situation)',
}

export const LANDING_SEO: Record<LandingPageKey, { title: string; description: string }> = {
  after_a_layoff: {
    title: 'Laid off? What to do this week and the money you may be owed',
    description: 'A plan for unemployment, severance, health coverage and your job search, plus the benefit and aid programs you may qualify for. Free for Members.',
  },
  still_searching: {
    title: 'No interviews after months of applying? What is holding your search back',
    description: 'A five-minute assessment shows how hard your search is, which parts you control and what to fix first. Free for Members, no résumé needed.',
  },
}
