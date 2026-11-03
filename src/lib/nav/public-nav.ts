// The public site's navigation: one list that the header menus and the footer both read, so the two never drift.
// Every hub page that leads to a page family belongs here (Google follows these links to find the pages beneath).

export interface PublicNavLink {
  label: string
  href: string
  /** One short line under the label in the menu; leave out when the label says it all. */
  hint?: string
}
export interface PublicNavGroup {
  heading: string
  links: PublicNavLink[]
}
export interface PublicNavMenu {
  key: 'jobs' | 'data' | 'help' | 'orgs'
  label: string
  groups: PublicNavGroup[]
}

export const PUBLIC_NAV: PublicNavMenu[] = [
  {
    key: 'jobs',
    label: 'Jobs',
    groups: [
      {
        heading: 'Find openings',
        links: [
          { label: 'Jobs by title', href: '/jobs/title', hint: 'Every professional title, with live openings' },
          { label: 'Jobs by industry', href: '/industries' },
          { label: 'Jobs by function', href: '/functions' },
          { label: 'Employers hiring', href: '/employers' },
          { label: 'Top employers', href: '/top-employers' },
        ],
      },
      {
        heading: 'Where to look',
        links: [
          { label: 'Local job markets', href: '/places', hint: 'Openings, pay and layoffs by metro' },
          { label: 'Search firms', href: '/search-firms' },
          { label: 'Conferences', href: '/conferences' },
        ],
      },
    ],
  },
  {
    key: 'data',
    label: 'Data',
    groups: [
      {
        heading: 'Pay and rankings',
        links: [
          { label: 'Salaries by title', href: '/salaries' },
          { label: 'Rankings', href: '/rankings', hint: 'Monthly lists of the best places, fields and degrees' },
        ],
      },
      {
        heading: 'Layoffs and the market',
        links: [
          { label: 'Layoff tracker', href: '/layoffs' },
          { label: 'White Collar Employment Report', href: '/reports/latest' },
          { label: 'AI skills data', href: '/ai-skills' },
        ],
      },
      {
        heading: 'Guides',
        links: [
          { label: 'Topics', href: '/topics', hint: 'Plain-language career guides' },
          { label: 'Glossary', href: '/glossary' },
        ],
      },
    ],
  },
  {
    key: 'help',
    label: 'Get help',
    groups: [
      {
        heading: 'After a layoff',
        links: [
          { label: 'What to do after a layoff', href: '/after-a-layoff' },
          { label: 'Unemployment benefits', href: '/unemployment-benefits' },
          { label: 'Funding for you', href: '/funding' },
        ],
      },
      {
        heading: 'Tools and learning',
        links: [
          { label: 'Free tools', href: '/tools' },
          { label: 'AI courses', href: '/ai-courses' },
          { label: 'Scam watch', href: '/scam-watch' },
        ],
      },
    ],
  },
  {
    key: 'orgs',
    label: 'For organizations',
    groups: [
      {
        heading: 'Employers',
        links: [
          { label: 'Hiring and posting jobs', href: '/talent' },
          { label: 'Outplacement', href: '/outplacement' },
          { label: 'Retention and learning', href: '/employees' },
          { label: 'Recruiters', href: '/recruiters' },
        ],
      },
      {
        heading: 'Partners',
        links: [
          { label: 'Colleges and universities', href: '/higher-education' },
          { label: 'Workforce boards', href: '/workforce-boards' },
          { label: 'Rapid response teams', href: '/for-rapid-response' },
          { label: 'American Job Centers', href: '/job-centers' },
          { label: 'Economic development', href: '/economic-development' },
          { label: 'Non-profits', href: '/nonprofits' },
          { label: 'Coaches', href: '/coaches' },
        ],
      },
    ],
  },
]

/** Pages that are about the company, not the product: they live in the footer. */
export const COMPANY_LINKS: PublicNavLink[] = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Why you’re stuck', href: '/why-stuck' },
  { label: 'About', href: '/about' },
  { label: 'News', href: '/news' },
  { label: 'Careers', href: '/careers' },
  { label: 'Press and data', href: '/press' },
  { label: 'Plans', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
]
