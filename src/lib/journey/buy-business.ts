// The Buy a business journey: deciding to buy a small business, finding one, financing it,
// closing, and running it well. Pure and client-safe: the page, the weekly plan, the
// onboarding answers and the tests all read this one file.
//
// Two ways to be on it. As the main journey (journey = BUY_BUSINESS), the shared stage
// (journeyStage) follows the buying stage below. Alongside another journey (laid off, thinking
// about a move, anything), the same intake and stage live in journeyDetails.buy, so a member can
// look for a job and for a business at once. journeyDetails.buy is the source of truth for both.
//
// Everything here is static: no model calls, nothing metered. Links were checked on 2026-10-22;
// marketplaces that block automated requests (BizBuySell, BizQuest, Axial, Quiet Light, DealStream,
// SCORE, Sunbelt) are well-known public sites and were kept.

import type { JourneyStage, JourneyType } from '@prisma/client'

export type BuyStageKey = 'decide' | 'prepare' | 'search' | 'evaluate' | 'close' | 'own' | 'run'

export type BuyPlanItem = { text: string; actionType?: string }

export type BuyStage = {
  key: BuyStageKey
  label: string
  /** The shared journey stage this maps onto when Buy a business is the main journey. */
  stage: JourneyStage
  /** What you are doing in this stage, in one line. */
  goal: string
  /** The one thing to do first. */
  next: string
  /** This stage's steps: first week, then ongoing. */
  firstWeek: BuyPlanItem[]
  ongoing: BuyPlanItem[]
}

const T = (text: string, actionType?: string): BuyPlanItem => ({ text, actionType })

export const BUY_STAGES: readonly BuyStage[] = [
  {
    key: 'decide',
    label: 'Decide',
    stage: 'EXPLORING',
    goal: 'Find out whether buying a business fits what you want from work and money.',
    next: 'Write down what you want from owning a business: income, hours, and what you will not do.',
    firstWeek: [
      T('Write down what you want from owning a business: income, hours, and what you will not do'),
      T('Talk to two people who bought a business and ask what surprised them', 'OUTREACH_CALL'),
      T('Read the first chapters of a buyer’s guide (see Training)'),
    ],
    ongoing: [T('Talk to one more owner or buyer this week', 'OUTREACH_CALL'), T('Finish the intake below so your list narrows to your size, industry and budget')],
  },
  {
    key: 'prepare',
    label: 'Get ready',
    stage: 'PREPARING',
    goal: 'Know your numbers, your target and your team before you look at listings.',
    next: 'Finish the intake so we can size what you can afford.',
    firstWeek: [
      T('Write your target on one page: industries, size, place, and how hands-on you will be'),
      T('List your cash, your credit and what you could borrow against, and what you must keep in reserve'),
      T('Get a free advisor: book your local SBDC or a SCORE mentor', 'OUTREACH_CALL'),
      T('Talk to two SBA lenders about pre-qualification', 'OUTREACH_CALL'),
    ],
    ongoing: [T('Line up an attorney who does business sales and a CPA who has reviewed a deal'), T('Take one buyer course from Training')],
  },
  {
    key: 'search',
    label: 'Search',
    stage: 'APPLYING',
    goal: 'See enough real businesses to know what a good one looks like.',
    next: 'Set a saved search on two marketplaces and look at five listings this week.',
    firstWeek: [
      T('Set a saved search with alerts on two marketplaces (see Where to find businesses)'),
      T('Call two business brokers in your area and tell them your target', 'OUTREACH_CALL'),
      T('Look at five listings and write down the asking price, the owner earnings and what you would check first'),
    ],
    ongoing: [
      T('Look at five more listings and sign the NDA on any that fit'),
      T('Send five direct notes to owners of businesses you would want, with no listing', 'OUTREACH_MESSAGE'),
      T('Ask one person in the industry what makes a business there good or bad', 'OUTREACH_CALL'),
    ],
  },
  {
    key: 'evaluate',
    label: 'Evaluate',
    stage: 'INTERVIEWING',
    goal: 'Pick one business, meet the owner, value it and make an offer.',
    next: 'Ask the owner for three years of tax returns and the profit and loss for the last twelve months.',
    firstWeek: [
      T('Meet the owner and ask why they are selling, what they do every week and which customers matter most'),
      T('Get three years of tax returns and the last twelve months of profit and loss'),
      T('Work out owner earnings (SDE) yourself and check it against the asking price'),
    ],
    ongoing: [T('Draft your letter of intent with your attorney: price, terms, financing, and a diligence period'), T('Ask your lender what this deal would need to qualify')],
  },
  {
    key: 'close',
    label: 'Diligence and close',
    stage: 'OFFER',
    goal: 'Confirm the numbers, finish the loan, sign, and plan the handover.',
    next: 'Have your CPA check that the profit and loss matches the tax returns and the bank statements.',
    firstWeek: [
      T('Have your CPA check the profit and loss against the tax returns and the bank statements'),
      T('Give your lender the full package and ask what is still missing'),
      T('Ask your attorney to list what you are buying: assets, contracts, leases, licences, employees'),
    ],
    ongoing: [T('Agree with the owner how long they will stay on, and what they will introduce you to'), T('Write your first-day plan for staff, customers and suppliers')],
  },
  {
    key: 'own',
    label: 'First 100 days',
    stage: 'LANDED',
    goal: 'Keep what works, learn the business, and earn trust before you change anything.',
    next: 'Tell every employee and your top customers in person in the first week.',
    firstWeek: [
      T('Meet every employee in the first week and tell them what is not changing'),
      T('Call your ten biggest customers and your key suppliers', 'OUTREACH_CALL'),
      T('Sit with the bank, the books and the person who does payroll, and learn the weekly cash cycle'),
    ],
    ongoing: [T('Change nothing big for 90 days; write down what you would change'), T('Review the numbers every week: cash, sales, margin, and what is owed to you')],
  },
  {
    key: 'run',
    label: 'Run and improve',
    stage: 'STAYING',
    goal: 'Make the business more profitable and less dependent on you.',
    next: 'Pick one number to improve this quarter: price, margin, or repeat customers.',
    firstWeek: [
      T('Pick one number to improve this quarter: price, margin, or repeat customers'),
      T('Write down the three jobs only you do, and who could learn each'),
    ],
    ongoing: [T('Review the numbers monthly with your CPA'), T('Write one process down so someone else can run it'), T('Have one conversation with another owner in your industry', 'OUTREACH_CALL')],
  },
] as const

export function getBuyStage(key: BuyStageKey): BuyStage {
  return BUY_STAGES.find((s) => s.key === key) ?? BUY_STAGES[0]
}

export function isBuyStageKey(v: unknown): v is BuyStageKey {
  return typeof v === 'string' && BUY_STAGES.some((s) => s.key === v)
}

/** The buying stage that matches a shared journey stage (used when Buy a business is the main journey). */
export function buyStageForJourneyStage(stage: JourneyStage | null | undefined): BuyStageKey {
  if (stage === 'PAUSED') return 'run'
  return BUY_STAGES.find((s) => s.stage === stage)?.key ?? 'decide'
}

export function journeyStageForBuyStage(key: BuyStageKey): JourneyStage {
  return getBuyStage(key).stage
}

// ── The intake ───────────────────────────────────────────────────────────────

export type BuyOption = { value: string; label: string }

export type BuyField = {
  key: BuyFieldKey
  label: string
  /** Why we ask, shown with the question. */
  why: string
  kind: 'choice' | 'multi' | 'text'
  options?: readonly BuyOption[]
}

export type BuyFieldKey = 'skills' | 'industries' | 'why' | 'size' | 'cash' | 'financing' | 'involvement' | 'where' | 'timeline' | 'partners' | 'ready' | 'credit'

const opts = (...pairs: [string, string][]): BuyOption[] => pairs.map(([value, label]) => ({ value, label }))

export const SKILL_OPTIONS = opts(
  ['sales', 'Sales and customers'],
  ['operations', 'Running operations'],
  ['finance', 'Finance and accounting'],
  ['marketing', 'Marketing'],
  ['people', 'Managing people'],
  ['technical', 'Trades or technical work'],
  ['software', 'Software and data'],
  ['healthcare', 'Healthcare'],
  ['supply', 'Supply chain and logistics'],
  ['service', 'Customer service'],
)

export const INDUSTRY_OPTIONS = opts(
  ['home_services', 'Home services (HVAC, plumbing, landscaping, cleaning)'],
  ['b2b_services', 'Business services (staffing, IT, accounting, marketing)'],
  ['healthcare', 'Healthcare and senior care'],
  ['trades', 'Construction and skilled trades'],
  ['distribution', 'Distribution and wholesale'],
  ['manufacturing', 'Manufacturing'],
  ['transport', 'Transportation and logistics'],
  ['automotive', 'Automotive'],
  ['education', 'Education and childcare'],
  ['hospitality', 'Restaurants and hospitality'],
  ['retail', 'Retail'],
  ['personal', 'Fitness, beauty and personal services'],
  ['software', 'Software and online businesses'],
  ['franchise', 'Franchise resales'],
)

export const SIZE_OPTIONS = opts(
  ['under_150', 'Owner earnings under $150,000 a year'],
  ['150_300', '$150,000 to $300,000'],
  ['300_500', '$300,000 to $500,000'],
  ['500_1000', '$500,000 to $1 million'],
  ['1000_3000', '$1 million to $3 million'],
  ['3000_plus', 'More than $3 million'],
)

export const CASH_OPTIONS = opts(
  ['under_50', 'Under $50,000'],
  ['50_100', '$50,000 to $100,000'],
  ['100_250', '$100,000 to $250,000'],
  ['250_500', '$250,000 to $500,000'],
  ['500_plus', 'More than $500,000'],
)

export const FINANCING_OPTIONS_INTAKE = opts(
  ['sba', 'An SBA loan'],
  ['seller', 'The seller finances part'],
  ['cash', 'My own cash'],
  ['robs', 'My 401(k) or IRA'],
  ['home', 'Home equity'],
  ['investors', 'Partners or investors'],
  ['unsure', 'I do not know yet'],
)

export const HARD_PART_OPTIONS = opts(
  ['hours', 'Working long hours for the first year'],
  ['guarantee', 'Personally guaranteeing a loan'],
  ['income', 'Earning less than I do now for a year or more'],
  ['people', 'Managing people, including hard conversations'],
  ['sell', 'Selling and asking customers for money'],
  ['paid_last', 'Being paid after employees, rent, taxes and the lender'],
)

export const BUY_FIELDS: readonly BuyField[] = [
  {
    key: 'skills',
    label: 'What are you best at?',
    why: 'Businesses that use what you already do well are the ones you can run and improve fastest.',
    kind: 'multi',
    options: SKILL_OPTIONS,
  },
  {
    key: 'industries',
    label: 'Which industries interest you?',
    why: 'We point you to the marketplaces and brokers that list these, and to the right training.',
    kind: 'multi',
    options: INDUSTRY_OPTIONS,
  },
  {
    key: 'why',
    label: 'What is the main reason you want to own a business?',
    why: 'It changes what we put first. Buying takes six months to a year, so some reasons call for income while you search. Private to you, and there is no wrong answer.',
    kind: 'choice',
    options: opts(
      ['boss', 'I want to be my own boss'],
      ['wealth', 'I want to build wealth and own something'],
      ['hiring', 'Employers are not hiring someone like me'],
      ['income', 'I need income soon and this looks like a way to get it'],
      ['legacy', 'I want to keep a business I know going'],
    ),
  },
  {
    key: 'size',
    label: 'How much should the business earn for its owner each year?',
    why: 'Owner earnings (SDE) is what the price is based on. It is the number to size everything else.',
    kind: 'choice',
    options: SIZE_OPTIONS,
  },
  {
    key: 'cash',
    label: 'How much cash can you put in?',
    why: 'An SBA loan needs at least 10% of the total cost from you, and closing costs and a cash cushion on top.',
    kind: 'choice',
    options: CASH_OPTIONS,
  },
  {
    key: 'financing',
    label: 'How do you expect to pay for it?',
    why: 'Each source has rules (for example, borrowed money does not count toward an SBA loan’s required cash). Pick all that apply.',
    kind: 'multi',
    options: FINANCING_OPTIONS_INTAKE,
  },
  {
    key: 'involvement',
    label: 'How involved do you want to be?',
    why: 'A business you run every day and one a manager runs are different purchases, at different prices.',
    kind: 'choice',
    options: opts(['hands_on', 'I will run it every day'], ['semi', 'I will own it and have a manager'], ['absentee', 'I want it to run without me']),
  },
  {
    key: 'where',
    label: 'Where should it be? (city, state or region)',
    why: 'Most small businesses are bought in the buyer’s own area. A place also tells us which brokers and lenders to show.',
    kind: 'text',
  },
  {
    key: 'timeline',
    label: 'When do you want to buy?',
    why: 'Most buyers take six months to a year. We set your weekly plan to your date.',
    kind: 'choice',
    options: opts(['3', 'Within 3 months'], ['6', 'Within 6 months'], ['12', 'Within a year'], ['explore', 'I am still exploring']),
  },
  {
    key: 'partners',
    label: 'Will you buy alone?',
    why: 'A partner or a spouse’s income changes what a lender will look at, and who has to sign.',
    kind: 'choice',
    options: opts(['solo', 'Alone'], ['partner', 'With a spouse or partner'], ['investors', 'With investors']),
  },
  {
    key: 'ready',
    label: 'Which of these hard parts are you ready for?',
    why: 'Every owner faces them. Each one you are not sure about gets a plan and something to learn, so nothing surprises you after you sign.',
    kind: 'multi',
    options: HARD_PART_OPTIONS,
  },
  {
    key: 'credit',
    label: 'Roughly, what is your credit score?',
    why: 'Lenders look at it first. Optional.',
    kind: 'choice',
    options: opts(['740', '740 or higher'], ['680', '680 to 739'], ['620', '620 to 679'], ['low', 'Under 620'], ['unsure', 'Not sure']),
  },
]

export type BuyIntake = Partial<Record<Exclude<BuyFieldKey, 'skills' | 'industries' | 'financing' | 'where' | 'ready'>, string>> & {
  skills?: string[]
  industries?: string[]
  financing?: string[]
  ready?: string[]
  where?: string
}

export type BuyDetails = BuyIntake & { stage?: BuyStageKey; startedAt?: string; listingsSeen?: number }

/** What a member has saved so far, read back safely from journeyDetails. */
export function buyDetailsOf(journeyDetails: unknown): BuyDetails {
  const raw = (journeyDetails as { buy?: unknown } | null)?.buy
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: BuyDetails = {}
  for (const f of BUY_FIELDS) {
    const v = r[f.key]
    if (f.kind === 'multi') {
      if (Array.isArray(v)) {
        const keep = v.filter((x): x is string => typeof x === 'string' && !!f.options?.some((o) => o.value === x))
        if (keep.length) (out as Record<string, unknown>)[f.key] = keep
      }
    } else if (f.kind === 'text') {
      if (typeof v === 'string' && v.trim()) out.where = v.trim().slice(0, 120)
    } else if (typeof v === 'string' && f.options?.some((o) => o.value === v)) {
      ;(out as Record<string, unknown>)[f.key] = v
    }
  }
  if (isBuyStageKey(r.stage)) out.stage = r.stage
  if (typeof r.startedAt === 'string') out.startedAt = r.startedAt
  return out
}

/** Whether the member has started this journey at all (alongside any other). */
export function hasBuyDetails(journeyDetails: unknown): boolean {
  const raw = (journeyDetails as { buy?: unknown } | null)?.buy
  return !!raw && typeof raw === 'object' && Object.keys(raw as object).length > 0
}

/** A value a form sent for one field, made safe. Blank or invalid returns null: leave it as it is. */
export function parseBuyValue(f: BuyField, raw: string | string[]): string | string[] | null {
  if (f.kind === 'multi') {
    const list = (Array.isArray(raw) ? raw : [raw]).map((s) => s.trim()).filter((s) => f.options?.some((o) => o.value === s))
    return list.length ? Array.from(new Set(list)) : null
  }
  const v = (Array.isArray(raw) ? raw[0] ?? '' : raw).trim()
  if (!v) return null
  if (f.kind === 'text') return v.slice(0, 120)
  return f.options?.some((o) => o.value === v) ? v : null
}

/** The fields still blank, in the order we ask, each with its reason. Drives the one "next question". */
export function missingBuyFields(d: BuyDetails): BuyField[] {
  return BUY_FIELDS.filter((f) => {
    if (f.key === 'credit') return false // optional: never nagged
    const v = (d as Record<string, unknown>)[f.key]
    return !(Array.isArray(v) ? v.length : v)
  })
}

// ── What the numbers allow ───────────────────────────────────────────────────

// Cash the buyer puts in, as the bottom and top of each band. The top of the open-ended band is a floor.
const CASH_RANGE: Record<string, [number, number]> = {
  under_50: [20_000, 50_000],
  '50_100': [50_000, 100_000],
  '100_250': [100_000, 250_000],
  '250_500': [250_000, 500_000],
  '500_plus': [500_000, 750_000],
}

export type BuyReach = {
  /** Price range that cash can support with an SBA loan, rounded. */
  priceLow: number
  priceHigh: number
  /** The plain reasoning, shown with the number. */
  because: string
}

// Rule of thumb, not a quote. An SBA 7(a) acquisition needs at least 10% of the total cost in cash from
// the buyer (price plus closing costs), and buyers usually keep another few percent for closing costs and a
// working-capital cushion, so cash is roughly 15% of the price. The result is a range, never a promise.
const CASH_SHARE_OF_PRICE = 0.15

export function buyReach(d: BuyDetails): BuyReach | null {
  if (!d.cash) return null
  const band = CASH_RANGE[d.cash]
  if (!band) return null
  const round = (n: number) => Math.round(n / 25_000) * 25_000
  const priceLow = round(band[0] / CASH_SHARE_OF_PRICE)
  const priceHigh = round(band[1] / CASH_SHARE_OF_PRICE)
  const money = (n: number) => `$${n.toLocaleString('en-US')}`
  return {
    priceLow,
    priceHigh,
    because: `An SBA loan needs at least 10% of the total cost from you, and most buyers keep about 5% more for closing costs and a cash cushion. At about 15% of the price, ${money(band[0])} to ${money(band[1])} of your own cash supports roughly ${money(priceLow)} to ${money(priceHigh)}. A rule of thumb, not an approval.`,
  }
}

/** Small businesses commonly sell for about two to four times owner earnings. Used to explain the size question. */
export const TYPICAL_MULTIPLE_NOTE =
  'Small businesses commonly sell for roughly two to four times the owner’s yearly earnings (SDE), depending on the industry, how much depends on the owner, and how steady the profit has been.'

// ── The weekly plan ──────────────────────────────────────────────────────────

/** Steps for the Weekly Search Sprint, for a member whose main journey is Buy a business. */
export function buyPlanItems(stageKey: BuyStageKey, weekNumber: number, d: BuyDetails | null = null): BuyPlanItem[] {
  const s = getBuyStage(stageKey)
  const base = weekNumber <= 1 ? s.firstWeek : s.ongoing
  const out = [...base]
  if (!d) return out
  if (missingBuyFields(d).length && (stageKey === 'decide' || stageKey === 'prepare')) {
    out.unshift(T('Answer the next question in your buying profile so your list narrows to what you can afford'))
  }
  if (stageKey === 'search' && d.financing?.includes('sba')) out.push(T('Check a listing against what an SBA lender will finance: price, earnings and your cash'))
  return out
}

// ── Where to find businesses ─────────────────────────────────────────────────

export type MarketplaceKind = 'marketplace' | 'aggregator' | 'brokers' | 'online' | 'community' | 'bigger'

export type Marketplace = {
  id: string
  name: string
  href: string
  kind: MarketplaceKind
  /** One line on what it is and who it suits. */
  summary: string
  /** Industry keys (INDUSTRY_OPTIONS) it is strongest for; empty means general. */
  industries?: readonly string[]
  /** Owner-earnings bands (SIZE_OPTIONS) it suits. */
  sizes?: readonly string[]
}

export const MARKETPLACE_KINDS: Record<MarketplaceKind, string> = {
  marketplace: 'Marketplaces',
  aggregator: 'Search across many',
  brokers: 'Broker networks',
  online: 'Online businesses',
  community: 'Buyers and search funds',
  bigger: 'Larger deals',
}

export const MARKETPLACES: readonly Marketplace[] = [
  {
    id: 'bizbuysell',
    name: 'BizBuySell',
    href: 'https://www.bizbuysell.com/',
    kind: 'marketplace',
    summary: 'The biggest general marketplace for small businesses: thousands of listings from brokers and owners, in every industry. Start here.',
  },
  {
    id: 'baton',
    name: 'Baton',
    href: 'https://www.baton.com/',
    kind: 'marketplace',
    summary: 'A marketplace built around financing: it works with a network of SBA lenders, so you can see what a deal needs to qualify while you browse.',
    sizes: ['150_300', '300_500', '500_1000', '1000_3000'],
  },
  {
    id: 'bizquest',
    name: 'BizQuest',
    href: 'https://www.bizquest.com/',
    kind: 'marketplace',
    summary: 'A second large marketplace with a different set of broker listings, including franchise resales. Check it next to BizBuySell.',
    industries: ['franchise', 'hospitality', 'retail'],
  },
  {
    id: 'dealstream',
    name: 'DealStream',
    href: 'https://www.dealstream.com/',
    kind: 'marketplace',
    summary: 'A deal marketplace where owners and intermediaries post businesses for sale, across small and mid-sized deals.',
  },
  {
    id: 'kumo',
    name: 'Kumo',
    href: 'https://www.withkumo.com/',
    kind: 'aggregator',
    summary: 'Pulls listings from many brokers and marketplaces into one search with alerts, and flags the same business listed twice. A paid tool built for buyers who search a lot.',
  },
  {
    id: 'tworld',
    name: 'Transworld Business Advisors',
    href: 'https://www.tworld.com/',
    kind: 'brokers',
    summary: 'A national brokerage network with local offices. Brokers show businesses not listed publicly, so tell them your target.',
  },
  {
    id: 'sunbelt',
    name: 'Sunbelt Business Brokers',
    href: 'https://www.sunbeltnetwork.com/',
    kind: 'brokers',
    summary: 'One of the largest broker networks, with independent local offices for small and middle-market deals.',
  },
  {
    id: 'vr',
    name: 'VR Business Brokers',
    href: 'https://www.vrbusinessbrokers.com/',
    kind: 'brokers',
    summary: 'A national network of local broker offices. Ask about off-market businesses in your area.',
  },
  {
    id: 'ibba',
    name: 'IBBA: find a business broker',
    href: 'https://www.ibba.org/',
    kind: 'brokers',
    summary: 'The trade association for business brokers. Use it to find a broker near you, or to check one’s credentials.',
  },
  {
    id: 'acquire',
    name: 'Acquire.com',
    href: 'https://acquire.com/',
    kind: 'online',
    summary: 'Software and subscription businesses for sale, listed by their founders. Good for software and internet businesses that can run from anywhere.',
    industries: ['software'],
  },
  {
    id: 'flippa',
    name: 'Flippa',
    href: 'https://flippa.com/',
    kind: 'online',
    summary: 'A marketplace for websites, online stores, apps and other internet businesses, from very small to larger.',
    industries: ['software', 'retail'],
    sizes: ['under_150', '150_300'],
  },
  {
    id: 'empireflippers',
    name: 'Empire Flippers',
    href: 'https://empireflippers.com/',
    kind: 'online',
    summary: 'A brokerage for established online businesses, with each listing reviewed before it is shown.',
    industries: ['software', 'retail'],
  },
  {
    id: 'quietlight',
    name: 'Quiet Light',
    href: 'https://quietlight.com/',
    kind: 'online',
    summary: 'A brokerage for online and e-commerce businesses, with advisors who guide the buyer.',
    industries: ['software', 'retail'],
  },
  {
    id: 'searchfunder',
    name: 'Searchfunder',
    href: 'https://searchfunder.com/',
    kind: 'community',
    summary: 'The community for people buying a business with investor backing (search funds) and for the investors, lawyers and lenders who work with them. Ask questions, see real deals.',
  },
  {
    id: 'axial',
    name: 'Axial',
    href: 'https://www.axial.net/',
    kind: 'bigger',
    summary: 'A network that connects investors and buyers with sellers and their advisors, mostly for larger deals. Useful if you are buying with investors.',
    sizes: ['1000_3000', '3000_plus'],
  },
]

/** The marketplaces to show first for this member: those that match their industries and size, then the rest. */
export function rankMarketplaces(d: BuyDetails): Marketplace[] {
  const score = (m: Marketplace) => {
    let s = 0
    if (m.industries?.some((i) => d.industries?.includes(i))) s += 2
    if (d.size && m.sizes?.includes(d.size)) s += 2
    if (!m.industries && !m.sizes) s += 1
    return s
  }
  return [...MARKETPLACES].sort((a, b) => score(b) - score(a))
}

// ── Financing ────────────────────────────────────────────────────────────────

export type FinancingOption = {
  id: string
  name: string
  summary: string
  /** The rules and trade-offs, each a plain sentence. */
  facts: string[]
  links: { label: string; href: string }[]
  /** The intake answer (FINANCING_OPTIONS_INTAKE) this belongs to. */
  intake?: string
}

export const FINANCING: readonly FinancingOption[] = [
  {
    id: 'sba7a',
    name: 'SBA 7(a) loan',
    intake: 'sba',
    summary: 'The most common way to finance buying a small business. A bank lends, and the SBA guarantees part of it.',
    facts: [
      'You put in at least 10% of the total cost (price plus closing costs).',
      'A note from the seller can count toward that 10% only if the seller does not collect payments for the life of the loan, and then for no more than half of it.',
      'The cash you put in cannot be borrowed.',
      'Lenders look at your credit, your experience in the industry and whether the business earns enough to cover the payments.',
    ],
    links: [
      { label: 'SBA 7(a) loans', href: 'https://www.sba.gov/loans/7a-loans/' },
      { label: 'Find SBA lenders (Lender Match)', href: 'https://www.sba.gov/loans/lender-match/' },
      { label: 'SBA rulebook for lenders (SOP 50 10)', href: 'https://www.sba.gov/document/sop-50-10-lender-development-company-loan-programs' },
    ],
  },
  {
    id: 'sba504',
    name: 'SBA 504 loan',
    summary: 'For buying real estate and large equipment, often in a business that owns its building. Not for working capital or goodwill.',
    facts: ['Fixed-rate financing through a certified development company alongside a bank loan.', 'Fits businesses where the building or equipment is most of the value.'],
    links: [{ label: 'SBA 504 loans', href: 'https://www.sba.gov/loans/504-loans/' }],
  },
  {
    id: 'seller',
    name: 'Seller financing',
    intake: 'seller',
    summary: 'The seller is paid part of the price over time. It keeps the seller invested in your success.',
    facts: [
      'Common in small deals; the size and terms are negotiated.',
      'With an SBA loan, rules limit how a seller note counts and when it is paid, so settle the structure with your lender before you make an offer.',
      'An earn-out (part of the price paid only if the business hits targets) works the same way.',
    ],
    links: [{ label: 'How a sale is taxed and the price split (IRS)', href: 'https://www.irs.gov/businesses/small-businesses-self-employed/sale-of-a-business' }],
  },
  {
    id: 'cash',
    name: 'Your own cash and home equity',
    intake: 'cash',
    summary: 'Savings are the base of every deal. Home equity can fund a purchase without an SBA loan, with real risk to your home.',
    facts: [
      'Borrowed money, including a home equity line, does not count toward the cash an SBA lender requires.',
      'Keep a cushion for the first months: many buyers also need cash for payroll and closing costs.',
    ],
    links: [{ label: 'Talk to a free advisor (SBDC)', href: 'https://americassbdc.org/' }],
  },
  {
    id: 'robs',
    name: 'Using a 401(k) or IRA (ROBS)',
    intake: 'robs',
    summary: 'Roll retirement money into a new company’s retirement plan, which then buys stock in the company that buys the business. No loan and no penalty if done correctly.',
    facts: [
      'Your retirement savings are tied to the success of one business.',
      'The IRS calls these arrangements questionable and examines them, and the plan has to file an annual return every year.',
      'Use a specialist provider and your own attorney and CPA. Promoter fees vary.',
    ],
    links: [{ label: 'IRS guidance on rollovers as business start-ups', href: 'https://www.irs.gov/retirement-plans/rollovers-as-business-start-ups-compliance-project' }],
  },
  {
    id: 'investors',
    name: 'Partners, investors and search funds',
    intake: 'investors',
    summary: 'Raise money from investors to find and buy a business, then run it. Right if you have the skill and not the cash.',
    facts: [
      'Investors fund your search and the purchase in return for ownership.',
      'It takes time to raise, and you answer to the people who funded you.',
      'The Stanford guide explains how it works from both sides.',
    ],
    links: [
      { label: 'Stanford: A Primer on Search Funds', href: 'https://www.gsb.stanford.edu/faculty-research/case-studies/primer-search-funds-practical-guide-entrepreneurs-embarking-search' },
      { label: 'Searchfunder community', href: 'https://searchfunder.com/' },
    ],
  },
]

/** Financing paths to show first: the ones the member picked, then the rest. */
export function rankFinancing(d: BuyDetails): FinancingOption[] {
  const picked = new Set(d.financing ?? [])
  const rank = (f: FinancingOption) => (f.intake && picked.has(f.intake) ? 0 : f.id === 'sba7a' ? 1 : 2)
  return [...FINANCING].sort((a, b) => rank(a) - rank(b))
}

// ── Training ─────────────────────────────────────────────────────────────────

export type TrainingItem = {
  id: string
  title: string
  summary: string
  href?: string
  /** Free to take. */
  free: boolean
  /** The stage where it helps most. */
  stage: BuyStageKey
}

export const BUY_TRAINING: readonly TrainingItem[] = [
  { id: 'sbdc', title: 'Free one-on-one advising from your SBDC', summary: 'A business advisor helps with your plan, a loan package and pricing a business. Free or low cost.', href: 'https://americassbdc.org/', free: true, stage: 'prepare' },
  { id: 'score', title: 'A free mentor from SCORE', summary: 'Volunteer mentors who have run and sold businesses, plus workshops on buying and running one.', href: 'https://www.score.org/', free: true, stage: 'decide' },
  { id: 'sba-learn', title: 'SBA Learning Platform', summary: 'Short free courses on starting, buying, financing and running a business.', href: 'https://learning.sba.gov/', free: true, stage: 'decide' },
  { id: 'sba-local', title: 'Find SBA counseling and training near you', summary: 'SBDCs, SCORE chapters, Women’s Business Centers and Veterans Business Outreach Centers in one search.', href: 'https://www.sba.gov/counseling/local-assistance/', free: true, stage: 'prepare' },
  { id: 'b2b', title: 'Boots to Business (veterans and military spouses)', summary: 'A free SBA entrepreneurship course for service members, veterans and military spouses, with online follow-on courses.', href: 'https://bootstobusiness.sba.gov/', free: true, stage: 'decide' },
  { id: 'stanford', title: 'Stanford: A Primer on Search Funds', summary: 'The standard guide to buying a business with investor backing: how to search, raise, buy and run.', href: 'https://www.gsb.stanford.edu/faculty-research/case-studies/primer-search-funds-practical-guide-entrepreneurs-embarking-search', free: true, stage: 'decide' },
  { id: 'lenders', title: 'Learn how SBA lenders decide', summary: 'The SBA’s page for lenders and the rulebook they follow. Read the sections on changes of ownership so you know what they will ask for.', href: 'https://www.sba.gov/sba-lenders/', free: true, stage: 'prepare' },
  { id: 'valuation', title: 'Find a business valuation professional', summary: 'Valuation analysts who have credentials from NACVA. Pay for one on any deal you are serious about.', href: 'https://www.nacva.com/', free: false, stage: 'evaluate' },
  { id: 'taxes', title: 'How the purchase price is split and taxed', summary: 'The IRS explains how the price is divided among assets, which changes both your taxes and the seller’s. Have your CPA lead.', href: 'https://www.irs.gov/businesses/small-businesses-self-employed/sale-of-a-business', free: true, stage: 'close' },
]

export const RUN_TRAINING: readonly TrainingItem[] = [
  { id: 'sba-manage', title: 'SBA: manage your business', summary: 'Hiring, taxes, bookkeeping, marketing and growth, in short guides.', href: 'https://www.sba.gov/business-guide/manage-your-business', free: true, stage: 'own' },
  { id: 'score-run', title: 'A SCORE mentor for the first year', summary: 'Keep the same mentor through the first 100 days and the first year. Ask for one who has run a business like yours.', href: 'https://www.score.org/', free: true, stage: 'own' },
  { id: 'sbdc-run', title: 'SBDC advising on cash, pricing and growth', summary: 'Ongoing free advising on the numbers, the next hire and what to improve first.', href: 'https://americassbdc.org/', free: true, stage: 'run' },
  { id: 'coach', title: 'Coaching on running it', summary: 'A coach for the hard parts: leading people who worked for the old owner, and making your first big changes.', href: '/dashboard/my-coaching', free: false, stage: 'run' },
]

export type BuyBook = { title: string; author: string; why: string }

export const BUY_BOOKS: readonly BuyBook[] = [
  { title: 'Buy Then Build', author: 'Walker Deibel', why: 'A buyer’s guide: how to pick a business, buy it and then grow it.' },
  { title: 'HBS Guide to Buying a Small Business', author: 'Richard Ruback and Royce Yudkoff', why: 'The search-fund method from Harvard: finding, valuing and buying a company.' },
]

/** What to learn at each stage, for the page's "learn this now" strip. */
export function trainingForStage(stage: BuyStageKey): TrainingItem[] {
  return [...BUY_TRAINING, ...RUN_TRAINING].filter((t) => t.stage === stage)
}

/** The questions to ask before signing anything. Shown in Evaluate and Diligence. */
export const DILIGENCE_CHECKS: readonly { check: string; why: string }[] = [
  { check: 'Does the profit and loss match the tax returns and the bank deposits?', why: 'Small-business books are often not audited. This is the check that finds problems.' },
  { check: 'What share of sales comes from the top five customers?', why: 'If one customer is a quarter of sales, losing them can end the deal.' },
  { check: 'What does the owner do every week, and who will do it after the sale?', why: 'Owner earnings assume you do the owner’s job. If the owner is the business, the price should reflect that.' },
  { check: 'Is the lease transferable, and for how long?', why: 'Without a lease you may lose the location the business depends on.' },
  { check: 'Which licences, contracts and permits transfer to a new owner?', why: 'Some end at the sale. Your attorney lists them.' },
  { check: 'Is anything owed: taxes, loans, unpaid bills, open disputes?', why: 'In an asset sale you usually leave these behind; confirm what you are buying and what you are not.' },
  { check: 'How long will the seller stay, and what will they introduce you to?', why: 'A paid handover of 30 to 90 days keeps customers and staff.' },
]

// ── Journey-level wiring ─────────────────────────────────────────────────────

/** The route of the buying page. It works for every member, whatever their main journey. */
export const BUY_PAGE_HREF = '/dashboard/buy-a-business'

export function isBuyJourney(j: JourneyType | null | undefined): boolean {
  return j === 'BUY_BUSINESS'
}

/** The headline for the page: what to do next, with the reason. */
export function buyHeadline(stage: BuyStageKey, d: BuyDetails): { title: string; because: string } {
  const gaps = missingBuyFields(d)
  if (gaps.length > 2 && (stage === 'decide' || stage === 'prepare')) {
    return { title: 'Tell us what you are looking for', because: 'A few short questions size what you can afford and point you to the right marketplaces, lenders and training.' }
  }
  const s = getBuyStage(stage)
  return { title: s.next, because: s.goal }
}

// ── Why they want to own, and the hard parts ─────────────────────────────────

export type BuyNote = { text: string; because: string; links: { label: string; href: string }[] }

const EARN_LINKS = [
  { label: 'Find interim or fractional work', href: '/dashboard/interim-work' },
  { label: 'Keep your job search going', href: '/dashboard/find-my-job' },
]

const WHY_NOTES: Record<string, BuyNote> = {
  boss: {
    text: 'Owning gives you independence, not freedom from bosses: customers, lenders and employees all depend on you.',
    because: 'You said you want to be your own boss. Ask two owners in your industry what they gave up, before you spend money.',
    links: [],
  },
  wealth: {
    text: 'In a small business, wealth comes from raising profit and, later, from selling it for more than you paid.',
    because: 'You said you want to build wealth. The run-and-improve training shows how owners raise profit.',
    links: [{ label: 'Learn how owners improve a business', href: '/dashboard/buy-a-business?tab=training' }],
  },
  hiring: {
    text: 'You do not have to be hired to own a business. Buying takes six months to a year, so keep income coming while you search.',
    because: 'You said employers are not hiring someone like you. A parallel path (fractional, interim or a job search) covers the months before you close.',
    links: EARN_LINKS,
  },
  income: {
    text: 'Buying is rarely the fast way to income: it takes six months to a year, and the first months of ownership are thin.',
    because: 'You said you need income soon. Keep income coming while you search, and size your cash cushion for a slow start.',
    links: EARN_LINKS,
  },
  legacy: {
    text: 'Buying a business you already know is the lowest-risk kind. Lenders and sellers both trust a buyer who knows the work.',
    because: 'You said you want to keep a business you know going. Ask the owner and the employees what happens after the sale.',
    links: [],
  },
}

/** One plain note on what the member's reason for buying means for their plan, or null when they have not said. */
export function whyNote(d: BuyDetails): BuyNote | null {
  return d.why ? (WHY_NOTES[d.why] ?? null) : null
}

export type HardPart = { key: string; title: string; because: string; learn: { label: string; href: string } }

const HARD_PARTS: Record<string, HardPart> = {
  hours: {
    key: 'hours',
    title: 'Long hours in the first year',
    because: 'The owner’s job is a job. Most first-year owners work more than they did as an employee.',
    learn: { label: 'Ask a SCORE mentor who has run a business like yours', href: 'https://www.score.org/' },
  },
  guarantee: {
    key: 'guarantee',
    title: 'Guaranteeing the loan yourself',
    because: 'SBA lenders require every owner of 20% or more to personally guarantee the loan, so your own assets stand behind it.',
    learn: { label: 'Read how SBA 7(a) loans work', href: 'https://www.sba.gov/loans/7a-loans/' },
  },
  income: {
    key: 'income',
    title: 'Lower pay for a year or more',
    because: 'Owners are paid after the business covers its costs, and early profit often goes to the loan first.',
    learn: { label: 'Look at interim or fractional work to cover the gap', href: '/dashboard/interim-work' },
  },
  people: {
    key: 'people',
    title: 'Managing people and hard conversations',
    because: 'You inherit the old owner’s team. Keeping good people and letting go of the wrong ones is most of the job.',
    learn: { label: 'SBA guides on hiring and managing', href: 'https://www.sba.gov/business-guide/manage-your-business' },
  },
  sell: {
    key: 'sell',
    title: 'Selling and asking for money',
    because: 'Owners sell all day: to customers, to lenders and to landlords. Customers rarely come on their own.',
    learn: { label: 'A free SBDC advisor can coach your pricing and sales', href: 'https://americassbdc.org/' },
  },
  paid_last: {
    key: 'paid_last',
    title: 'Being paid last',
    because: 'Payroll, rent, taxes and the loan payment come before the owner. A thin month can mean no pay.',
    learn: { label: 'Size your cash cushion', href: '/dashboard/buy-a-business?tab=financing' },
  },
}

/** The hard parts the member did not tick, each with why it matters and where to learn. Empty until they have answered. */
export function hardPartsToPlanFor(d: BuyDetails): HardPart[] {
  if (!d.ready) return []
  return HARD_PART_OPTIONS.filter((o) => !d.ready!.includes(o.value)).map((o) => HARD_PARTS[o.value])
}

// ── Podcasts and videos ──────────────────────────────────────────────────────

export type MediaItem = {
  id: string
  title: string
  kind: 'podcast' | 'video'
  by: string
  summary: string
  href: string
  stage: BuyStageKey
}

// Public shows, linked only; we are not affiliated with any of them. Links checked 2026-10-23.
export const BUY_MEDIA: readonly MediaItem[] = [
  { id: 'acquiring-minds', title: 'Acquiring Minds', kind: 'podcast', by: 'Will Smith', summary: 'Hundreds of interviews with people who bought a business: how they found it, paid for it and ran it.', href: 'https://acquiringminds.co/', stage: 'decide' },
  { id: 'eta-insider', title: 'ETA Insider', kind: 'podcast', by: 'Brian O’Connor, Polsky Center, Chicago Booth', summary: 'Searchers and the investors who back them, on buying a company and what the first years are like.', href: 'https://polsky.uchicago.edu/podcasts/', stage: 'prepare' },
  { id: 'found-funded', title: 'The Found & Funded Podcast', kind: 'podcast', by: 'Carl Lundberg', summary: 'For people who want to own a business but do not have a startup idea: searching, funding and buying.', href: 'https://podcasts.apple.com/us/podcast/the-found-funded-podcast/id1778471971', stage: 'search' },
  { id: 'codie-sanchez', title: 'Codie Sanchez', kind: 'video', by: 'YouTube', summary: 'A buyer and owner of everyday Main Street businesses on how to find, price and run them.', href: 'https://www.youtube.com/@CodieSanchezCT', stage: 'search' },
  { id: 'hormozi', title: 'Alex Hormozi', kind: 'video', by: 'YouTube', summary: 'Pricing, offers, hiring and sales for owners. Most useful once you own a business.', href: 'https://www.youtube.com/@AlexHormozi', stage: 'run' },
  { id: 'podcast-roundup', title: 'More shows for buyers', kind: 'podcast', by: 'Searchfunder members', summary: 'A community list that adds Acquisitions Anonymous, Think Like an Owner and others.', href: 'https://www.searchfunder.com/post/best-podcasts-for-buying-and-operating-businesses', stage: 'decide' },
]

/** Shows that fit the member's stage first. */
export function mediaForStage(stage: BuyStageKey): MediaItem[] {
  return [...BUY_MEDIA].sort((a, b) => Number(b.stage === stage) - Number(a.stage === stage))
}
