// Bylined authors. Every guide, insight, news take and report is written by
// the founder today; when that changes, add the person here and pass their
// slug to <AuthorByline>.

import { FOUNDER_LINKEDIN_URL } from '@/lib/contact/constants'
import { SITE_URL } from './facts'

export interface Author {
  slug: string
  name: string
  jobTitle: string
  /** Bio lines, taken word for word from facts already stated on /about. */
  bio: string[]
  /** Headshot under /public, if there is one. */
  image: string | null
  linkedIn: string
  alumniOf: string[]
}

export const AUTHORS: Record<string, Author> = {
  'justin-kulla': {
    slug: 'justin-kulla',
    name: 'Justin Kulla',
    jobTitle: 'Founder & CEO, NextChapter',
    bio: [
      'Justin Kulla is the founder of NextChapter. He has spent nearly 20 years as an investor, founder and operator in education technology.',
      'He founded BusinessBlocks, a venture-backed education company for small businesses, and led it as CEO through a successful exit to AmTrust Financial, a Fortune 500 company. At AmTrust he became SVP and Head of Global M&A and Venture Investments.',
      'He is a Partner at TZP Group, where he leads impact and education investments. He was a founding member of Weld North, where he invested in Imagine Learning, The Learning House and Performance Matters, and served as CTO of Edgenuity. He started his career in technology at Credit Suisse and Google.',
      'He holds an MBA from MIT, a Master of Public Administration from Harvard and a master’s in Information Systems Management from Carnegie Mellon, and is a lecturer at Stanford and MIT.',
    ],
    image: '/images/team/justin-kulla.jpg',
    linkedIn: FOUNDER_LINKEDIN_URL,
    alumniOf: ['Massachusetts Institute of Technology', 'Harvard University', 'Carnegie Mellon University'],
  },
}

export const DEFAULT_AUTHOR = AUTHORS['justin-kulla']

export const authorPath = (a: Author) => `/authors/${a.slug}`
export const authorId = (a: Author) => `${SITE_URL}${authorPath(a)}#person`
