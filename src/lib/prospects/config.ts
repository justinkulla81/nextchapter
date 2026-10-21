/**
 * Prospect pages: one private, unlisted page per organization we are reaching out to, built from public data, with a claim button.
 * Each page is composed from the same sections, with the facts and the angle chosen for who it is for.
 */
export type ProspectKind = 'talent' | 'college' | 'employer'

export interface Prospect {
  slug: string
  name: string
  kind: ProspectKind
  /** The CRM organization type used when someone claims the page. */
  orgType: 'NONPROFIT' | 'UNIVERSITY' | 'EMPLOYER'
  /** Place patterns for the job crawler's free-text location ("Louisville, KY"), matched case-insensitively. */
  places: string[]
  placeLabel: string
  state: string
  /** Counties (lower case, no "County") whose layoff notices belong to the picture; empty means the whole state. */
  counties: string[]
  /** City words that place a layoff notice with no county, matched against the notice's address. */
  cityWords?: string[]
  /** GeoArea id (county FIPS) for unemployment and population. */
  areaId: string
  /** Job functions the page leads with, when it is about particular kinds of work. */
  functions?: string[]
  /** The label for the last outcome, what "kept local" means to them. */
  stayLabel: string
  headline: string
  lede: string
  /** The one-sentence ask behind the claim button. */
  claimLine: string
}

export const PROSPECTS: Record<string, Prospect> = {
  'live-in-lou': {
    slug: 'live-in-lou', name: 'Live in Lou', kind: 'talent', orgType: 'NONPROFIT',
    places: ['Louisville, KY%', 'Louisville, Kentucky%', '%, Louisville, KY%'], placeLabel: 'Louisville', state: 'KY', counties: [], areaId: '21111', stayLabel: 'Landed in Louisville',
    headline: 'Louisville is hiring. Keep the people it already has.',
    lede: 'Live in Lou brings talent to Louisville. When a layoff sends skilled people looking, the cheapest talent win is the one already here. This page shows what we see in the local market today, and what it would take to keep every laid-off professional in the region.',
    claimLine: 'Activate this page and we will set up a Louisville workspace for Live in Lou, with a sign-up link you can share with any employer in a layoff.',
  },
  'washington-jefferson': {
    slug: 'washington-jefferson', name: 'Washington & Jefferson College', kind: 'college', orgType: 'UNIVERSITY',
    places: ['Pittsburgh, PA%', 'Pittsburgh, Pennsylvania%', '%, Pittsburgh, PA%', 'Canonsburg, PA%', 'Washington, PA%', 'Cecil, PA%'], placeLabel: 'the Pittsburgh region', state: 'PA',
    counties: ['washington', 'allegheny', 'westmoreland', 'beaver', 'butler', 'fayette', 'greene'],
    cityWords: ['pittsburgh', 'canonsburg', 'washington, pa', 'monroeville', 'cranberry', 'coraopolis', 'bridgeville', 'mckeesport', 'greensburg', 'uniontown', 'waynesburg', 'beaver', 'butler'], areaId: '42125', stayLabel: 'Landed in the region',
    headline: 'Your alumni are in the middle of a changing job market. Be the first call.',
    lede: 'When layoffs hit the Pittsburgh region, the people affected include W&J graduates. This page shows the market they face, the local roles open today, and how W&J can offer retraining and a way back in to every affected alum, with their consent.',
    claimLine: 'Activate this page and we will set up a W&J alumni workspace, so affected alumni hear from you first and can find retraining through your programs.',
  },
  'brown-forman': {
    slug: 'brown-forman', name: 'Brown-Forman', kind: 'employer', orgType: 'EMPLOYER',
    places: ['Louisville, KY%', 'Louisville, Kentucky%', '%, Louisville, KY%'], placeLabel: 'Louisville', state: 'KY', counties: [], areaId: '21111',
    functions: ['Marketing', 'Finance', 'Sales', 'Operations', 'Human Resources', 'Legal', 'Data & Analytics', 'Product', 'Executive Leadership'], stayLabel: 'Landed in Louisville',
    headline: 'The people who left Brown-Forman are still part of Brown-Forman.',
    lede: 'Reductions end on a date; searches do not. The people who left are in a market where 28% of white-collar searchers are still looking after 27 weeks. This page shows the Louisville market they are in, and a way for Brown-Forman to stay connected to them, support the next search, and bring the best back.',
    claimLine: 'Activate this page and we will set up a Brown-Forman alumni and transition workspace: one link for anyone leaving, and counts of who engaged, interviewed and landed, never names.',
  },
}

export const REPORT_URL = 'https://launchyournextchapter.com/reports/white-collar-employment-report-september-2026'
