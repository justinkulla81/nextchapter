import type { SituationKey } from '@/lib/constants/onboarding'
import type { NewsTagKey } from '@/lib/news/tags'

/**
 * The employee-side journeys for white-collar workers: what an employer asks of you, what it gives you, what your pay buys,
 * and income on the side. Each is a public page (/journeys/<slug>) fed by a News tag, with one registration ask, "Is this you?".
 * `situation` is the onboarding answer the ask hands over, so the first question arrives preselected.
 * Statements here are general and carry no figures; numbers on a page come from live sources (see `data`).
 */
export interface EmployeeJourney {
  slug: string
  /** Short name for links and the chips. */
  label: string
  h1: string
  lede: string
  /** The News tag that fills this page's story list. */
  tag: NewsTagKey
  situation: SituationKey
  /** The box under the heading: headline and one sentence. */
  ask: { headline: string; sentence: string }
  /** "Is this you?": what the reader would recognise. */
  signs: string[]
  /** Good for the employee / worth watching. Each says why. */
  inYourFavor: { h: string; p: string }[]
  watchFor: { h: string; p: string }[]
  /** Which live numbers the page shows. */
  data: 'pay' | 'none'
  /** Pages of ours that go deeper. */
  next: { label: string; href: string }[]
  updated: string
}

export const EMPLOYEE_JOURNEYS: EmployeeJourney[] = [
  {
    slug: 'your-rights-at-work',
    label: 'Your rights at work and on the way out',
    h1: 'Your rights at work, and what you sign on the way out',
    lede: 'Non-disparagement clauses, NDAs, noncompetes, return-to-office rules and severance terms decide what you can say, where you can go next and what you keep. The stories below follow how employers use them, and how employees push back.',
    tag: 'worker_rights',
    situation: 'worried_let_go',
    ask: {
      headline: 'Is this you?',
      sentence: 'You have been handed terms to sign, or you sense a reorganization coming. Your free Market Reality Assessment shows your options while you still have time to choose, privately.',
    },
    signs: [
      'You were offered a severance, exit or transfer agreement and are not sure what it stops you from saying or doing.',
      'Your contract has a noncompete or non-disparagement clause and you are thinking about a move.',
      'A new policy (return to office, a performance plan, a reorganization) is changing what you signed up for.',
    ],
    inYourFavor: [
      { h: 'Terms are often negotiable before you sign', p: 'Employers that want a clean exit usually have room on the amount, the length of a restriction and how broad a clause is. Asking costs little before you sign and a lot after.' },
      { h: 'Some limits are set by law, not by the contract', p: 'Rules on what an agreement can stop you reporting, and on which restrictions a court will enforce, differ by role and by state, and managers usually have fewer protections than rank-and-file staff. Read the clause against your own state and role.' },
    ],
    watchFor: [
      { h: 'Broad non-disparagement language', p: 'A clause that bars any negative statement can reach what you say to future employers, recruiters and reviewers, and it may carry repayment of your severance if broken.' },
      { h: 'Signing deadlines', p: 'A short deadline is a negotiating tactic. Ask for the full time you are entitled to, and use it to see what else is on offer elsewhere.' },
    ],
    data: 'none',
    next: [
      { label: 'How severance works', href: '/topics/severance' },
      { label: 'Should I take the buyout?', href: '/topics/should-i-take-the-buyout' },
      { label: 'Unemployment benefits by state', href: '/unemployment-benefits' },
      { label: 'Layoff tracker: WARN notices by employer', href: '/layoffs' },
    ],
    updated: '2026-11-04',
  },
  {
    slug: 'white-collar-benefits',
    label: 'Benefits that matter',
    h1: 'White-collar benefits: what employers give, and what they are taking back',
    lede: 'Retirement match, health coverage, leave, flexibility and learning budgets are part of what a job pays. They change quietly, and they decide what a raise or a move is really worth. The stories below follow both the improvements and the cuts.',
    tag: 'benefits',
    situation: 'growing_in_job',
    ask: {
      headline: 'Is this you?',
      sentence: 'You are weighing a job, a counter-offer or a stay by salary alone. Your free Market Reality Assessment shows what the market pays for your role so you can compare the whole package.',
    },
    signs: [
      'You are comparing an offer or a counter-offer and the salary is the only number you have.',
      'Your employer changed its retirement match, health plan, leave or hybrid policy and you are not sure what that is worth.',
      'You stay partly for a benefit and want to know whether you could get it, or better, elsewhere.',
    ],
    inYourFavor: [
      { h: 'Benefits are part of the price of keeping you', p: 'When hiring is competitive, employers add leave, flexibility and learning budgets before they raise base pay, because they are cheaper to offer and harder to compare. Ask what applies to your level.' },
      { h: 'A match is pay you only get by taking part', p: 'A retirement match is part of compensation, so not contributing enough to receive all of it leaves part of your pay unclaimed.' },
    ],
    watchFor: [
      { h: 'Cuts that arrive as policy changes', p: 'A change to the match, the waiting period, remote days or coverage tiers changes your total pay without a pay-day notice. Check the plan documents each enrollment season.' },
      { h: 'Benefits that end when the job does', p: 'Health coverage, equity vesting and leave usually stop or reset on exit. Know the dates before you resign or sign an exit agreement.' },
    ],
    data: 'none',
    next: [
      { label: 'Should I take the buyout?', href: '/topics/should-i-take-the-buyout' },
      { label: 'Unemployment benefits by state', href: '/unemployment-benefits' },
      { label: 'Salaries by role', href: '/salaries' },
    ],
    updated: '2026-11-04',
  },
  {
    slug: 'pay-and-cost-of-living',
    label: 'Pay and cost of living',
    h1: 'Pay against the cost of living: is your raise keeping up?',
    lede: 'A raise only helps if it beats what things cost. The numbers below are the Bureau of Labor Statistics’ latest, for all private-sector workers and all urban consumers, and the stories follow what employers are paying and what workers are doing about it.',
    tag: 'pay_and_costs',
    situation: 'looking_for_promotion',
    ask: {
      headline: 'Is this you?',
      sentence: 'Your pay rose less than your bills, or you have not had a raise in a year. Your free Market Reality Assessment shows what the market pays for your role and how to ask for it.',
    },
    signs: [
      'Your last raise was smaller than the rise in rent, groceries or insurance.',
      'You have been in your role a year or more without a pay conversation.',
      'You suspect you are paid below the market but have no number to take into the room.',
    ],
    inYourFavor: [
      { h: 'A market number changes the conversation', p: 'A raise request that names what comparable roles pay, in your area and at your level, is harder to wave off than one based on effort or tenure.' },
      { h: 'Moving is often the biggest raise', p: 'Pay set at hiring tends to reflect today’s market, while raises inside a company follow a budget. Knowing your outside value shows which path pays more.' },
    ],
    watchFor: [
      { h: 'Averages hide your situation', p: 'The national figures are across all workers. Your field, your city and your level can run well above or below them, so use them as context, not as your number.' },
      { h: 'Housing and insurance can outrun the index', p: 'The overall price index blends many things. If your biggest bills are rent and premiums, check those categories rather than the headline.' },
    ],
    data: 'pay',
    next: [
      { label: 'Salaries by role and place', href: '/salaries' },
      { label: 'White Collar Employment Report', href: '/reports/latest' },
      { label: 'Top employers', href: '/top-employers' },
    ],
    updated: '2026-11-04',
  },
  {
    slug: 'side-hustles',
    label: 'Side hustles and second incomes',
    h1: 'Side hustles for white-collar workers: income you control',
    lede: 'Consulting, fractional work, teaching, freelance projects and small businesses give a salaried professional a second source of income and a way to test a next move. The stories below follow what is working, and what employers allow.',
    tag: 'side_income',
    situation: 'building_something',
    ask: {
      headline: 'Is this you?',
      sentence: 'You earn on the side, or want to, and you want to keep your job and your options open. Your free Market Reality Assessment shows what your skills are worth on the market, privately.',
    },
    signs: [
      'You do freelance, consulting or project work outside your job, or you are thinking about starting.',
      'You worry that a layoff would leave you with one income and no pipeline.',
      'You want to know whether your side work could become the next act.',
    ],
    inYourFavor: [
      { h: 'A second income softens a layoff', p: 'Clients and a track record outside your employer mean one decision at one company does not take away all your income.' },
      { h: 'It tests a move before you make it', p: 'Fractional, advisory or consulting work shows whether demand exists for what you do, with a paycheck still in place.' },
    ],
    watchFor: [
      { h: 'Your employment agreement', p: 'Outside-work, conflict-of-interest and invention-assignment clauses can limit what you do and who for. Read them before you take a client in your own field.' },
      { h: 'Taxes and time', p: 'Self-employment income is taxed differently from wages and often needs quarterly payments. Count the hours too: a side income that costs your main job is not a gain.' },
    ],
    data: 'none',
    next: [
      { label: 'Starting something while you keep your job', href: '/start/building-something' },
      { label: 'Fractional and interim work', href: '/start/happy-with-fractional-work' },
      { label: 'Skills that hold their value', href: '/skills' },
    ],
    updated: '2026-11-04',
  },
]

export const getEmployeeJourney = (slug: string) => EMPLOYEE_JOURNEYS.find((j) => j.slug === slug)
