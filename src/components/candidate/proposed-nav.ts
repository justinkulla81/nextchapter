// The proposed candidate menu, for the mockups. Six places, each with at most six entries. An entry
// with parts shows them as small switches at the top of its page.
export type PlaceId = 'home' | 'jobs' | 'network' | 'learn' | 'account' | 'money' | 'help'

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
  { id: 'home', label: 'Home', entries: [{ key: 'today', label: 'Your week' }, { key: 'tailored', label: 'Improve your search' }, { key: 'progress', label: 'Effort and results', parts: [{ key: 'built', label: 'What you’ve built' }, { key: 'timeline', label: 'Your search timeline' }] }] },
  {
    id: 'jobs',
    label: 'Jobs',
    entries: [
      { key: 'find', label: 'Find a job', parts: [{ key: 'jobs', label: 'Jobs' }, { key: 'unposted', label: 'Not posted yet' }, { key: 'independent', label: 'Independent work' }, { key: 'resources', label: 'Resources' }] },
      { key: 'apply', label: 'Get ready to apply', parts: [{ key: 'resume', label: 'Résumé' }, { key: 'whyhire', label: 'Why hire me' }] },
      { key: 'mine', label: 'My jobs' },
      { key: 'companies', label: 'Companies' },
      { key: 'market', label: 'Market and pay', parts: [{ key: 'market', label: 'Your market' }, { key: 'pay', label: 'Know your worth' }, { key: 'local', label: 'Local market' }] },
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
  {
    id: 'learn',
    label: 'Learn',
    entries: [
      { key: 'learn', label: 'Skills and courses', parts: [{ key: 'skills', label: 'Skills' }, { key: 'videos', label: 'Videos and webinars' }] },
      { key: 'know', label: 'Know yourself' },
      { key: 'path', label: 'Your path', parts: [{ key: 'story', label: 'Career story' }, { key: 'roles', label: 'Other roles you could do' }] },
    ],
  },
  {
    id: 'money',
    label: 'Finances and benefits',
    entries: [{ key: 'runway', label: 'Your runway' }, { key: 'deadlines', label: 'Benefits and deadlines' }],
  },
  {
    id: 'account',
    label: 'Account and privacy',
    entries: [{ key: 'profile', label: 'Profile' }, { key: 'visibility', label: 'Who can find you' }, { key: 'documents', label: 'Documents' }, { key: 'money', label: 'Money help' }, { key: 'membership', label: 'Membership' }],
  },
  { id: 'help', label: 'Help', entries: [{ key: 'talk', label: 'Talk to someone' }, { key: 'work', label: 'A hard situation at work', parts: [{ key: 'start', label: 'Describe it' }, { key: 'options', label: 'Your options' }, { key: 'ask', label: 'Ask others' }] }, { key: 'scams', label: 'Scam watch' }, { key: 'questions', label: 'Questions and feedback' }] },
]
