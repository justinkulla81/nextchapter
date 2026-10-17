// The proposed candidate menu, for the mockups. Six places, each with at most six entries. An entry
// with parts shows them as small switches at the top of its page.
export type PlaceId = 'home' | 'jobs' | 'network' | 'learn' | 'personalize' | 'help'

export interface NavEntry {
  key: string
  label: string
  /** Parts shown as switches on the page. The first is where the entry opens. */
  parts?: { key: string; label: string }[]
}

export interface NavPlace {
  id: PlaceId
  label: string
  entries: NavEntry[]
}

export const PROPOSED_NAV: NavPlace[] = [
  { id: 'home', label: 'Home', entries: [{ key: 'today', label: 'Today' }, { key: 'tailored', label: 'Tailored for you' }, { key: 'progress', label: 'Progress', parts: [{ key: 'built', label: 'What you’ve built' }, { key: 'timeline', label: 'Your search timeline' }] }] },
  {
    id: 'jobs',
    label: 'Jobs',
    entries: [
      { key: 'find', label: 'Find a job', parts: [{ key: 'jobs', label: 'Jobs' }, { key: 'unposted', label: 'Not posted yet' }, { key: 'independent', label: 'Independent work' }, { key: 'resources', label: 'Resources' }] },
      { key: 'mine', label: 'My jobs' },
      { key: 'companies', label: 'Companies' },
      { key: 'market', label: 'Market and pay', parts: [{ key: 'market', label: 'Your market' }, { key: 'pay', label: 'Know your worth' }, { key: 'local', label: 'Local market' }, { key: 'pivot', label: 'Other roles you could do' }] },
      { key: 'interviews', label: 'Interviews' },
      { key: 'offers', label: 'Offers' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    entries: [
      { key: 'circles', label: 'Your network', parts: [{ key: 'overview', label: 'All circles' }, { key: 'close', label: 'Close circle' }, { key: 'know', label: 'People you know' }, { key: 'alumni', label: 'Alumni and groups' }, { key: 'industry', label: 'Industry and function' }, { key: 'recruiters', label: 'Recruiters' }] },
      { key: 'week', label: 'This week' },
      { key: 'messages', label: 'Messages' },
    ],
  },
  { id: 'learn', label: 'Learn', entries: [{ key: 'learn', label: 'Learn', parts: [{ key: 'skills', label: 'Skills and courses' }, { key: 'videos', label: 'Videos and webinars' }] }] },
  {
    id: 'personalize',
    label: 'Personalize',
    entries: [
      { key: 'profile', label: 'My profile', parts: [{ key: 'profile', label: 'Profile' }, { key: 'resume', label: 'Résumé' }, { key: 'whyhire', label: 'Why hire me' }, { key: 'career', label: 'Career story' }, { key: 'work', label: 'How I work' }] },
      { key: 'search', label: 'My search' },
      { key: 'recruiters', label: 'What recruiters see' },
      { key: 'documents', label: 'Documents' },
      { key: 'membership', label: 'Membership' },
    ],
  },
  { id: 'help', label: 'Help', entries: [{ key: 'talk', label: 'Talk to someone' }, { key: 'money', label: 'Money and benefits' }, { key: 'scams', label: 'Scam watch' }, { key: 'questions', label: 'Questions and feedback' }] },
]
