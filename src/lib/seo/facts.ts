// The facts search engines and AI answer tools quote about NextChapter, in one
// place. llms.txt, the Organization JSON-LD and the About page metadata all
// read from here so they can never disagree. Change a fact here, not there.

import { COMPANY_LINKEDIN_URL, CONTACT_EMAIL, FOUNDER_LINKEDIN_URL } from '@/lib/contact/constants'

export const SITE_URL = 'https://launchyournextchapter.com'

export const ORGANIZATION_ID = `${SITE_URL}/#organization`

export const FACTS = {
  name: 'NextChapter',
  url: SITE_URL,
  /** One line: what it is. */
  tagline: 'The AI platform for career transitions.',
  /** Who it is for. */
  audience:
    'Experienced professionals between jobs or planning a move, and the organizations that serve them: employers running layoffs, outplacement buyers, recruiters, coaches, workforce boards and nonprofits.',
  /** What candidates pay. */
  candidatePrice: 'Free for candidates, always.',
  founder: {
    name: 'Justin Kulla',
    jobTitle: 'Founder & CEO',
    linkedIn: FOUNDER_LINKEDIN_URL,
    authorPath: '/authors/justin-kulla',
  },
  /** TODO(Justin): founding year isn't stated anywhere on the site yet. */
  foundingYear: null as number | null,
  contactEmail: CONTACT_EMAIL,
  linkedIn: COMPANY_LINKEDIN_URL,
  logo: `${SITE_URL}/icon.png`,
} as const
