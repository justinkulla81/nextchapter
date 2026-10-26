// The facts search engines and AI answer tools quote about NextChapter, in one
// place. llms.txt, the Organization JSON-LD and the About page metadata all
// read from here so they can never disagree. Change a fact here, not there.

import { COMPANY_LINKEDIN_URL, CONTACT_EMAIL, FOUNDER_LINKEDIN_URL } from '@/lib/contact/constants'

export const SITE_URL = 'https://launchyournextchapter.com'

export const ORGANIZATION_ID = `${SITE_URL}/#organization`

/** The category line. Use it once at a natural intro (site and page descriptions, first contact), not in every paragraph. docs/BRANDING.md. */
export const POSITIONING = 'the leading job transition platform'

export const FACTS = {
  name: 'NextChapter',
  url: SITE_URL,
  /** One line: what it is. */
  tagline: `${POSITIONING[0].toUpperCase()}${POSITIONING.slice(1)} for white-collar workers.`,
  /** How people write the name when they mean this company; the bare name is shared with unrelated products. */
  alternateNames: ['Launch Your NextChapter', 'launchyournextchapter.com'],
  /** One line that separates this NextChapter from the others that share the name. */
  disambiguation:
    'NextChapter at launchyournextchapter.com is a U.S. job transition platform for laid-off and career-changing white-collar professionals, with a free Market Reality Assessment, a weekly Search Sprint plan and an AI career coach.',
  /** Who it is for. */
  audience:
    'Experienced professionals between jobs or planning a move, and the organizations that serve them: employers running layoffs, outplacement buyers, recruiters, coaches, workforce boards and nonprofits.',
  /** One paragraph: what it is and how it makes money. */
  summary:
    'NextChapter is the leading job transition platform. Every job seeker gets a free Market Reality Assessment (a plain-language read on how the market sees their background), a weekly Search Sprint action plan, and an AI career coach. Revenue comes from employers, recruiters, outplacement buyers, workforce agencies and nonprofits, and from optional coaching and resume plans.',
  /** What candidates pay. */
  candidatePrice: 'Free for candidates, always.',
  founder: {
    name: 'Justin Kulla',
    jobTitle: 'Founder & CEO',
    linkedIn: FOUNDER_LINKEDIN_URL,
    authorPath: '/authors/justin-kulla',
  },
  foundingYear: 2026 as number | null,
  contactEmail: CONTACT_EMAIL,
  linkedIn: COMPANY_LINKEDIN_URL,
  logo: `${SITE_URL}/icon.png`,
} as const
