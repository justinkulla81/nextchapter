// "Advisory and boards": getting onto boards and advisory roles, for members who want one (planning a next act,
// senior leaders, anyone building a portfolio of roles). Static copy that changes with the board experience the
// member has told us (journeyDetails.boardExperience, the same answer the Planning the next act journey asks), plus
// where to look. No statistics, no generated text, nothing metered. Pure: src/test/advisory-boards.test.ts.

export type BoardExperience = 'NONE' | 'ADVISORY' | 'BOARD'
export const BOARD_EXPERIENCE_OPTIONS: readonly { value: BoardExperience; label: string }[] = [
  { value: 'NONE', label: 'None yet' },
  { value: 'ADVISORY', label: 'Advisory roles' },
  { value: 'BOARD', label: 'Served on a board' },
]

export function boardExperienceOf(details: unknown): BoardExperience | null {
  const v = (details as { boardExperience?: unknown } | null)?.boardExperience
  return BOARD_EXPERIENCE_OPTIONS.some((o) => o.value === v) ? (v as BoardExperience) : null
}

export function boardSectorsOf(details: unknown): string {
  const v = (details as { boardSectors?: unknown } | null)?.boardSectors
  return typeof v === 'string' ? v.trim().slice(0, 120) : ''
}

export interface AdvisorySource {
  name: string
  /** What it is, in words that say who it is for. */
  about: string
  href: string
}

/** Checked 2026-10-25. BoardSource refuses automated requests (HTTP 403) but is a public site, so it stays. */
export const ADVISORY_SOURCES: readonly AdvisorySource[] = [
  { name: 'BoardSource: board posting and matching programs', about: 'A directory of programs that match volunteers and professionals with nonprofits looking for board members.', href: 'https://boardsource.org/initiatives/board-recruitment/board-posting-matching/' },
  { name: 'Taproot Foundation', about: 'Connects professionals with nonprofits for pro bono work and board service.', href: 'https://taprootfoundation.org/' },
  { name: 'BoardProspects', about: 'A board-candidate network for corporate boards. Executives join with a recommendation from an experienced director in their network.', href: 'https://www.boardprospects.com/' },
  { name: 'Founder Institute: the FAST advisor agreement', about: 'A free one-page advisor agreement for startups, with equity set by how much the advisor does and the company\'s stage.', href: 'https://fi.co/fast' },
]

export interface AdvisoryStep {
  key: string
  title: string
  body: string
  href?: string
  hrefLabel?: string
}

export interface AdvisoryPlan {
  title: string
  intro: string
  experience: BoardExperience | null
  /** What to do next, given where they are. */
  next: AdvisoryStep
  lanes: { key: 'startup' | 'nonprofit' | 'corporate' | 'fractional'; title: string; body: string }[]
  steps: AdvisoryStep[]
  sources: readonly AdvisorySource[]
  coach: { title: string; why: string; reason: 'boards' }
}

const NEXT: Record<BoardExperience, AdvisoryStep> = {
  NONE: {
    key: 'first_seat',
    title: 'Join one nonprofit committee or advisory group',
    body: 'A committee seat is how people get their first board seat: you show up, you are useful, and the board sees it. Ask one organization you already support.',
  },
  ADVISORY: {
    key: 'ask_for_board',
    title: 'Ask an organization you advised to introduce you to its board',
    body: 'They already trust your judgment. Say which board you would serve on and why, and ask for one introduction.',
  },
  BOARD: {
    key: 'chair_reference',
    title: 'Ask a board chair you served with for a reference',
    body: 'A chair speaking for you is the strongest thing a new board hears. Ask for one you can use now.',
  },
}

const UNKNOWN_NEXT: AdvisoryStep = {
  key: 'pick_where',
  title: 'Tell us where you are today',
  body: 'It changes what we put first: a first seat, an introduction to a board, or a reference from a chair.',
}

export function advisoryPlan(details: unknown): AdvisoryPlan {
  const experience = boardExperienceOf(details)
  const sectors = boardSectorsOf(details)
  return {
    title: 'Get onto the boards and advisory roles that fit you',
    intro:
      'Boards and advisory seats fill through people who already know you, so the way in is a small first role, one introduction at a time, and a short list of places you would serve. Nothing here mentions a job search.',
    experience,
    next: experience ? NEXT[experience] : UNKNOWN_NEXT,
    lanes: [
      { key: 'startup', title: 'Startup advisory', body: 'Founders want an experienced operator for an hour a month. It is usually paid in a small amount of equity that vests over time, written up in a short advisor agreement.' },
      { key: 'nonprofit', title: 'Nonprofit boards', body: 'The most open door. Organizations need people with your skills, and many are looking now. Start with one you already support, then a matching program.' },
      { key: 'corporate', title: 'Corporate boards', body: 'The hardest door and mostly a long game. Seats go to people known by directors and search firms, which is why being found and your recruiter relationships come first.' },
      { key: 'fractional', title: 'Fractional and interim work', body: 'Paid, hands-on work for a few organizations at once. It often leads to advisory seats, and it covers income while you build the rest.' },
    ],
    steps: [
      { key: 'list_ten', title: sectors ? `List 10 organizations in ${sectors} you would serve` : 'List 10 organizations you would serve', body: 'Name them, then find who on your network is closest to each. One warm introduction beats ten applications.', href: '/dashboard/companies', hrefLabel: 'Open my companies' },
      { key: 'positioning', title: 'Write your board and advisory profile', body: 'One page: what you have run, what you would advise on, and the sectors you care about. Keep it about the value, not the title.', href: '/dashboard/network/be-found', hrefLabel: 'Open Be found' },
      { key: 'talk', title: 'Have two conversations a month about boards or advisory work', body: 'Ask a current board member how they got their seat. Most will tell you, and many will introduce you.', href: '/dashboard/network/contacts', hrefLabel: 'Open my contacts' },
      { key: 'paid', title: 'Look at fractional and interim roles', body: 'Paid work with a few organizations, which often turns into an advisory seat.', href: '/dashboard/interim-work', hrefLabel: 'Open interim work' },
    ],
    sources: ADVISORY_SOURCES,
    coach: {
      reason: 'boards',
      title: 'A coach knows how seats actually fill',
      why: 'A coach helps you pick your lane, shapes your board profile, and gets you your first introduction. Most people never ask for one.',
    },
  }
}
