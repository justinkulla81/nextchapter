// Starting a business: from an idea to first customers to growth, and the free or public help for each step (a school's
// entrepreneurship center, local advisors, incubators and accelerators, programs for owners, funding). Pure and
// client-safe: the page, the weekly plan and the tests read this one file.
//
// It is the plan behind the "Building something of my own" journey (ENTREPRENEUR) and the "Starting a business" parallel
// path (src/lib/journey/paths.ts). The stage and answers live in journeyDetails.start so they survive a change of journey; the
// shared journey stage is not touched (a builder keeps their career plan). What we already ask is not asked again: the venture
// itself (journeyDetails.venture), months of runway (journeyDetails.runwayMonths) and hours a week (hoursAvailable).
//
// We link out to public and free programs and have no relationship with any of them. Links checked 2026-10-23; sites that block
// automated requests (SCORE, F6S) are well-known public sites and were kept.

export type StartStageKey = 'idea' | 'validate' | 'build' | 'launch' | 'grow'

export type StartPlanItem = { text: string; actionType?: string }

export type StartStage = {
  key: StartStageKey
  label: string
  goal: string
  next: string
  firstWeek: StartPlanItem[]
  ongoing: StartPlanItem[]
}

const T = (text: string, actionType?: string): StartPlanItem => ({ text, actionType })

export const START_STAGES: readonly StartStage[] = [
  {
    key: 'idea',
    label: 'Idea',
    goal: 'Know who has the problem, and why you are the one to fix it.',
    next: 'Write one sentence: who has this problem, and what do they do about it today?',
    firstWeek: [
      T('Write one sentence: who has this problem, and what do they do about it today?'),
      T('List five people who have the problem and ask each for 15 minutes', 'OUTREACH_MESSAGE'),
      T('Find out whether your school has an entrepreneurship center, an innovation hub or a pitch competition'),
    ],
    ongoing: [T('Talk to two more people who have the problem and write down their exact words', 'OUTREACH_CALL'), T('Book a free advisor: your local SBDC or a SCORE mentor', 'OUTREACH_CALL')],
  },
  {
    key: 'validate',
    label: 'Validate',
    goal: 'Prove someone will pay before you build much.',
    next: 'Ask three people to pay, pre-order or sign up for the smallest version of it.',
    firstWeek: [
      T('Describe the smallest version you could sell, and its price, in three lines'),
      T('Ask three people to pay, pre-order or sign up for it', 'OUTREACH_CALL'),
      T('Write down who else solves this today and what they charge'),
    ],
    ongoing: [T('Ask three more people to pay, and note every reason they say no', 'OUTREACH_CALL'), T('Decide what you would have to see to keep going, and by what date')],
  },
  {
    key: 'build',
    label: 'Build',
    goal: 'Make the smallest thing that works, and set up the business around it.',
    next: 'Pick the one thing that must work before your first customer, and finish it this week.',
    firstWeek: [
      T('Pick the one thing that must work before your first customer, and finish it this week'),
      T('Choose a structure and register: ask your SBDC advisor which fits (sole proprietor, LLC, corporation)'),
      T('Open a separate business bank account'),
    ],
    ongoing: [T('Work through the SBA’s steps to start a business, one a week'), T('Write a one-page plan: customers, price, costs and how you will find the next ten customers')],
  },
  {
    key: 'launch',
    label: 'Launch',
    goal: 'Get your first paying customers and learn from each.',
    next: 'Ask ten people for money this week, and write down what each one says.',
    firstWeek: [
      T('Ask ten people for money this week, and write down what each one says', 'OUTREACH_MESSAGE'),
      T('Set a price you can defend and a way to be paid'),
      T('Ask your first customer what almost stopped them from buying'),
    ],
    ongoing: [T('Get one more paying customer this week', 'OUTREACH_CALL'), T('Ask each customer for one introduction', 'OUTREACH_MESSAGE'), T('Write down your numbers every week: leads, sales, money in and out')],
  },
  {
    key: 'grow',
    label: 'Grow',
    goal: 'Make it steadier and less dependent on you.',
    next: 'Pick one number to improve this quarter: customers, price or repeat sales.',
    firstWeek: [T('Pick one number to improve this quarter: customers, price or repeat sales'), T('Write down the three jobs only you do, and who could learn each')],
    ongoing: [T('Review your numbers monthly with a free advisor'), T('Look at programs for established owners (see Find help)'), T('Have one conversation with another owner in your industry', 'OUTREACH_CALL')],
  },
] as const

export function getStartStage(key: StartStageKey): StartStage {
  return START_STAGES.find((s) => s.key === key) ?? START_STAGES[0]
}

export const isStartStageKey = (v: unknown): v is StartStageKey => START_STAGES.some((s) => s.key === v)

// ── What we ask ──────────────────────────────────────────────────────────────

export type StartOption = { value: string; label: string }
const opts = (...pairs: [string, string][]): StartOption[] => pairs.map(([value, label]) => ({ value, label }))

export type StartFieldKey = 'kind' | 'customers' | 'team' | 'funding'

export type StartField = { key: StartFieldKey; label: string; why: string; kind: 'choice' | 'multi'; options: readonly StartOption[] }

export const START_FIELDS: readonly StartField[] = [
  {
    key: 'customers',
    label: 'Where are you with customers?',
    why: 'It tells us which step to start you on, and which help matters most now.',
    kind: 'choice',
    options: opts(['none', 'No customers yet'], ['talked', 'I have talked to people who would buy'], ['first', 'My first paying customers'], ['steady', 'Steady revenue']),
  },
  {
    key: 'kind',
    label: 'What kind of business is it?',
    why: 'The right advisors, programs and funding differ: a software company and a local shop do not look for the same help.',
    kind: 'choice',
    options: opts(['product', 'Product or online store'], ['services', 'Services or consulting'], ['local', 'Local shop or storefront'], ['tech', 'Software or technology'], ['social', 'Nonprofit or social venture']),
  },
  {
    key: 'team',
    label: 'Are you building it alone?',
    why: 'Co-founders and teams change the legal structure and what a lender or program looks at.',
    kind: 'choice',
    options: opts(['solo', 'Alone'], ['cofounder', 'With a co-founder'], ['team', 'With a team']),
  },
  {
    key: 'funding',
    label: 'How do you expect to pay for it?',
    why: 'Each source has different rules. Pick all that apply.',
    kind: 'multi',
    options: opts(['savings', 'My savings'], ['revenue', 'Money from customers'], ['friends', 'Friends and family'], ['loans', 'A loan'], ['grants', 'Grants or competitions'], ['investors', 'Investors or an accelerator'], ['none', 'I do not know yet']),
  },
]

export type StartDetails = { stage?: StartStageKey; kind?: string; customers?: string; team?: string; funding?: string[]; startedAt?: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** What the member has saved so far, read back safely from journeyDetails.start. */
export function startDetailsOf(journeyDetails: unknown): StartDetails {
  const raw = (journeyDetails as { start?: unknown } | null)?.start
  if (!isObj(raw)) return {}
  const out: StartDetails = {}
  for (const f of START_FIELDS) {
    const v = raw[f.key]
    if (f.kind === 'multi') {
      if (Array.isArray(v)) {
        const keep = v.filter((x): x is string => typeof x === 'string' && f.options.some((o) => o.value === x))
        if (keep.length) out.funding = keep
      }
    } else if (typeof v === 'string' && f.options.some((o) => o.value === v)) {
      ;(out as Record<string, unknown>)[f.key] = v
    }
  }
  if (isStartStageKey(raw.stage)) out.stage = raw.stage
  if (typeof raw.startedAt === 'string') out.startedAt = raw.startedAt
  return out
}

export function hasStartDetails(journeyDetails: unknown): boolean {
  const raw = (journeyDetails as { start?: unknown } | null)?.start
  return isObj(raw) && Object.keys(raw).length > 0
}

/** A form's value for one field, made safe. Blank or invalid returns null: leave the old answer alone. */
export function parseStartValue(f: StartField, raw: string | string[]): string | string[] | null {
  if (f.kind === 'multi') {
    const list = (Array.isArray(raw) ? raw : [raw]).map((s) => s.trim()).filter((s) => f.options.some((o) => o.value === s))
    return list.length ? Array.from(new Set(list)) : null
  }
  const v = (Array.isArray(raw) ? (raw[0] ?? '') : raw).trim()
  return v && f.options.some((o) => o.value === v) ? v : null
}

/** The questions still blank, in the order we ask. */
export function missingStartFields(d: StartDetails): StartField[] {
  return START_FIELDS.filter((f) => {
    const v = (d as Record<string, unknown>)[f.key]
    return !(Array.isArray(v) ? v.length : v)
  })
}

/** Where someone with this much traction would start, so we can suggest a step instead of asking for one. */
export function suggestedStage(customers: string | undefined): StartStageKey {
  if (customers === 'steady') return 'grow'
  if (customers === 'first') return 'launch'
  if (customers === 'talked') return 'validate'
  return 'idea'
}

/** The stage they are on: the one they set, else what their traction suggests, else the first. */
export function currentStartStage(d: StartDetails): StartStageKey {
  return d.stage ?? suggestedStage(d.customers)
}

// ── The plan ─────────────────────────────────────────────────────────────────

/** Steps for the weekly plan: this stage's, plus what their hours and runway say. At most three. */
export function startPlanItems(journeyDetails: unknown, weekNumber: number): StartPlanItem[] {
  const d = startDetailsOf(journeyDetails)
  const s = getStartStage(currentStartStage(d))
  const base = weekNumber <= 1 ? s.firstWeek : s.ongoing
  const out = [...base]
  const runway = (journeyDetails as { runwayMonths?: unknown } | null)?.runwayMonths
  if (typeof runway === 'number' && runway <= 6) out.push(T(`You have about ${runway} months of runway: decide the date by which you would take contract work, and put it in your calendar`))
  return out.slice(0, 3)
}

// ── Where to get help ────────────────────────────────────────────────────────

export type HelpGroup = 'school' | 'local' | 'accelerators' | 'owners' | 'funding'

export const HELP_GROUP_LABEL: Record<HelpGroup, string> = {
  school: 'Start with your school',
  local: 'Free local help',
  accelerators: 'Incubators and accelerators',
  owners: 'Programs for owners already in business',
  funding: 'Money to start and grow',
}

export type HelpItem = {
  id: string
  group: HelpGroup
  name: string
  href: string
  summary: string
  /** Business kinds it suits best (START_FIELDS kind); empty = any. */
  kinds?: readonly string[]
  /** Stages where it helps most. */
  stages: readonly StartStageKey[]
}

export const START_HELP: readonly HelpItem[] = [
  {
    id: 'icorps',
    group: 'school',
    name: 'NSF Innovation Corps (I-Corps)',
    href: 'https://new.nsf.gov/funding/initiatives/i-corps',
    summary: 'A national program, run through universities, that teaches researchers and technical founders to test demand before they build. Ask your school’s research office.',
    kinds: ['tech', 'product'],
    stages: ['idea', 'validate'],
  },
  {
    id: 'sbdc',
    group: 'local',
    name: 'Your Small Business Development Center',
    href: 'https://americassbdc.org/',
    summary: 'Free or low-cost one-on-one advising on your plan, structure, numbers and loans. Many are hosted by colleges.',
    stages: ['idea', 'validate', 'build', 'launch', 'grow'],
  },
  {
    id: 'score',
    group: 'local',
    name: 'SCORE mentors',
    href: 'https://www.score.org/',
    summary: 'Free mentors who have started and run businesses, with workshops on every stage. Ask for someone in your kind of business.',
    stages: ['idea', 'validate', 'build', 'launch', 'grow'],
  },
  {
    id: 'sba-local',
    group: 'local',
    name: 'SBA local help: Women’s Business Centers, Veterans Business Outreach Centers and more',
    href: 'https://www.sba.gov/local-assistance',
    summary: 'One search for every SBA-backed center near you, including ones for women, veterans and rural owners.',
    stages: ['idea', 'validate', 'build', 'launch', 'grow'],
  },
  {
    id: 'sba-steps',
    group: 'local',
    name: 'SBA: 10 steps to start your business',
    href: 'https://www.sba.gov/business-guide/10-steps-start-your-business',
    summary: 'The government’s checklist: plan, structure, register, tax IDs, licenses and a bank account. Do one step a week.',
    stages: ['build', 'launch'],
  },
  {
    id: 'b2b',
    group: 'local',
    name: 'Boots to Business (veterans and military spouses)',
    href: 'https://bootstobusiness.sba.gov/',
    summary: 'A free SBA course in starting a business for service members, veterans and military spouses.',
    stages: ['idea', 'validate', 'build'],
  },
  {
    id: 'chamber',
    group: 'local',
    name: 'Your local chamber of commerce',
    href: 'https://www.uschamber.com/co',
    summary: 'Customers, introductions and local events. Many chambers run networking for new owners.',
    kinds: ['local', 'services'],
    stages: ['launch', 'grow'],
  },
  {
    id: 'inbia',
    group: 'accelerators',
    name: 'Find an incubator near you (INBIA)',
    href: 'https://www.inbia.org/',
    summary: 'The trade association for incubators and business centers. Incubators give space, advisors and peers, often for a small fee and no ownership.',
    stages: ['validate', 'build', 'launch'],
  },
  {
    id: 'yc',
    group: 'accelerators',
    name: 'Y Combinator',
    href: 'https://www.ycombinator.com/apply',
    summary: 'The best-known accelerator for fast-growth technology companies. Funding and a three-month program in return for ownership. Not for most small businesses.',
    kinds: ['tech'],
    stages: ['validate', 'build'],
  },
  {
    id: 'techstars',
    group: 'accelerators',
    name: 'Techstars accelerators',
    href: 'https://www.techstars.com/accelerators',
    summary: 'Programs in many cities and industries for fast-growth companies, with mentors and funding in return for ownership.',
    kinds: ['tech', 'product'],
    stages: ['validate', 'build', 'launch'],
  },
  {
    id: 'venturecafe',
    group: 'accelerators',
    name: 'Venture Café',
    href: 'https://venturecafeglobal.org/',
    summary: 'Weekly gatherings in innovation districts where founders, mentors and investors meet. Free or low cost.',
    kinds: ['tech', 'product', 'social'],
    stages: ['idea', 'validate', 'build'],
  },
  {
    id: 'f6s',
    group: 'accelerators',
    name: 'F6S: programs, competitions and perks',
    href: 'https://www.f6s.com/',
    summary: 'A directory of accelerators, pitch competitions and founder perks to apply to.',
    kinds: ['tech', 'product'],
    stages: ['idea', 'validate', 'build'],
  },
  {
    id: '10ksb',
    group: 'owners',
    name: 'Goldman Sachs 10,000 Small Businesses',
    href: 'https://10ksbapply.com/program-details/',
    summary: 'Free business education, capital access and support for owners whose businesses are already running. Check the current revenue, years and staff rules on the program page; it is offered in limited places.',
    stages: ['grow'],
  },
  {
    id: 'sba-learn',
    group: 'owners',
    name: 'SBA Learning Platform',
    href: 'https://learning.sba.gov/',
    summary: 'Short free courses on starting, financing and running a business.',
    stages: ['idea', 'validate', 'build', 'launch', 'grow'],
  },
  {
    id: 'microloans',
    group: 'funding',
    name: 'SBA microloans',
    href: 'https://www.sba.gov/funding-programs/loans/microloans',
    summary: 'Small loans for starting or growing a business, through nonprofit lenders who also give training.',
    stages: ['build', 'launch', 'grow'],
  },
  {
    id: 'sbir',
    group: 'funding',
    name: 'SBIR and STTR: America’s Seed Fund',
    href: 'https://www.sbir.gov/',
    summary: 'Federal research and development funding for technology companies, with no ownership given up. Slow and competitive, and worth knowing early.',
    kinds: ['tech'],
    stages: ['validate', 'build'],
  },
  {
    id: 'funding-page',
    group: 'funding',
    name: 'Funding you qualify for, on NextChapter',
    href: '/dashboard/funding',
    summary: 'Programs matched to where you live and your situation, including ones for founders.',
    stages: ['idea', 'validate', 'build', 'launch', 'grow'],
  },
]

/** Help ordered for this member: their stage first, then their kind of business. */
export function rankHelp(d: StartDetails): HelpItem[] {
  const stage = currentStartStage(d)
  const score = (h: HelpItem) => (h.stages.includes(stage) ? 2 : 0) + (d.kind && h.kinds?.includes(d.kind) ? 1 : 0) - (d.kind && h.kinds && !h.kinds.includes(d.kind) ? 2 : 0)
  return [...START_HELP].sort((a, b) => score(b) - score(a))
}

/** A search for the member's own school's entrepreneurship center. The member opens it; nothing is sent from here. */
export function schoolCenterSearch(schoolName: string | null | undefined): string | null {
  const name = (schoolName ?? '').trim().slice(0, 120)
  if (!name) return null
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} entrepreneurship center alumni`)}`
}

/** Who to ask at a school, in order. Many schools open these to alumni; some charge. */
export const SCHOOL_ASKS: readonly { who: string; ask: string }[] = [
  { who: 'The career center', ask: 'Do you have an entrepreneurship advisor, and can alumni use it?' },
  { who: 'The business or engineering school', ask: 'Is there an entrepreneurship center, an incubator or a pitch competition?' },
  { who: 'The research or tech transfer office', ask: 'If your idea comes from research: what support is there for turning it into a company?' },
  { who: 'The alumni office', ask: 'Which alumni started companies, and will one talk to you for 20 minutes?' },
]

export const START_PAGE_HREF = '/dashboard/start-a-business'
