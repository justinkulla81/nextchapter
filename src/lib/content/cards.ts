// Pure builders: one story's data in, one Card out (card.ts turns a Card into the channel versions). Wording stays
// within what the data says: no cause for a layoff, no forecast from an exposure score, no named private person.
import { addDays, DEADLINE_STEPS } from '@/lib/tools/layoff-deadlines'
import { RETRAINING_LINE, bandOf, retrainingNeed, scorePercent } from '@/lib/skills/ai-exposure'
import { checkPath } from '@/lib/ai-check/slug'
import { stateName, stateSlug } from '@/lib/seo/states'
import type { Credibility } from '@/lib/linkedin/layoff-post-rules'
import type { Card } from './card'

const n = (v: number) => v.toLocaleString('en-US')
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
const usd = (v: number) => `$${n(Math.round(v / 1000) * 1000)}`

const FILE_FIRST = DEADLINE_STEPS.find((s) => s.id === 'd2')!.body

export const CREDIBILITY_SOURCE: Record<Credibility, string> = {
  'warn-filing': 'the state WARN filing',
  'sec-filing': "the company's SEC filing",
  'two-publishers': 'news reports from two publishers',
  'trusted-outlet': 'a major news outlet',
  unconfirmed: 'news reports',
}

export interface LayoffInput {
  employer: string
  employees: number
  state: string | null
  place: string | null
  effectiveDate: Date | null
  credibility: Credibility
  /** The /layoffs/company/<slug> page for the employer. */
  slug: string
  /** Open white-collar roles on the board in the same state, when known. */
  openRolesInState: number | null
}

export function layoffCard(x: LayoffInput): Card {
  const where = x.place ?? (x.state ? stateName(x.state) : null)
  const headline =
    x.credibility === 'warn-filing'
      ? `${x.employer} filed a layoff notice naming ${n(x.employees)} workers${where ? ` in ${where}` : ''}`
      : x.credibility === 'sec-filing'
        ? `${x.employer} told the SEC it is cutting about ${n(x.employees)} jobs`
        : `${x.employer} has announced about ${n(x.employees)} job cuts`
  const points = [
    x.effectiveDate ? `The layoffs are effective ${day(x.effectiveDate)}` : `Federal WARN generally requires covered employers to give 60 days' notice`,
    ...(x.openRolesInState && x.state ? [`${n(x.openRolesInState)} white-collar roles are open on NextChapter in ${stateName(x.state)} today`] : []),
  ]
  return {
    kind: 'layoff', subject: x.slug, headline, big: n(x.employees), bigLabel: x.credibility === 'warn-filing' ? 'workers named in the notice' : 'jobs cut',
    points,
    action: `If you are affected, file for unemployment right away. ${FILE_FIRST.split('. ')[0]}`,
    source: CREDIBILITY_SOURCE[x.credibility].replace(/^./, (c) => c.toUpperCase()),
    path: `/layoffs/company/${x.slug}`,
    subreddits: ['layoffs', 'jobs', 'careerguidance'],
    hashtags: ['layoffs', 'jobsearch', 'careers'],
  }
}

export interface AiJobInput {
  soc6: string
  title: string
  score: number
  medianWage: number | null
  growthPct: number | null
}

export function aiJobCard(x: AiJobInput): Card {
  const pct = scorePercent(x.score)
  const band = bandOf(x.score)
  const lower = x.title.toLowerCase()
  const points = [
    band === 'little'
      ? `Little AI use is seen so far in ${lower} work: ${pct} of its tasks`
      : `AI is already used for ${pct} of the tasks in ${lower} work, measured from real usage`,
    ...(x.medianWage ? [`The median pay is ${usd(x.medianWage)} a year`] : []),
    ...(x.growthPct != null ? [`Employment is projected to ${x.growthPct >= 0 ? 'grow' : 'fall'} ${Math.abs(Math.round(x.growthPct * 10) / 10)}% over the projection period`] : []),
  ].slice(0, 3)
  return {
    kind: 'ai-job', subject: x.soc6,
    headline: band === 'little' ? `Little AI use is seen so far in ${lower} work` : `AI is already used for ${pct} of the tasks in ${lower} work`,
    big: pct, bigLabel: 'of tasks already see AI use',
    points,
    action: RETRAINING_LINE[retrainingNeed({ soc6: x.soc6, title: x.title, score: x.score, band })],
    source: 'Anthropic Economic Index (March 2026), which measures use seen now and is not a forecast of job loss',
    path: checkPath(x.title, x.soc6),
    subreddits: ['careerguidance', 'jobs', 'cscareerquestions'],
    hashtags: ['AI', 'futureofwork', 'careers'],
  }
}

export interface AiPayInput {
  /** Level-adjusted % when there are enough like-for-like postings, else the raw %. */
  pct: number
  likeForLike: boolean
  nAi: number
  nBase: number
  liveJobs: number
  aiSkillJobs: number
  asOf: string
}

export function aiPayCard(x: AiPayInput): Card {
  const sign = x.pct >= 0 ? '+' : '-'
  const big = `${sign}${Math.abs(Math.round(x.pct))}%`
  const share = x.liveJobs ? Math.round((100 * x.aiSkillJobs) / x.liveJobs) : null
  return {
    kind: 'ai-pay', subject: 'premium',
    headline: x.pct >= 0
      ? `Jobs that ask for an AI skill advertise ${Math.abs(Math.round(x.pct))}% more pay${x.likeForLike ? ' than the same job without one' : ''}`
      : `Jobs that ask for an AI skill advertise ${Math.abs(Math.round(x.pct))}% less pay${x.likeForLike ? ' than the same job without one' : ''}`,
    big, bigLabel: x.likeForLike ? 'posted pay, same function, level and industry' : 'median posted pay, AI-skill jobs vs the rest',
    points: [
      `It compares ${n(x.nAi)} postings that ask for an AI skill with ${n(x.nBase)} that never mention AI, using the pay range each employer posted`,
      ...(share != null ? [`${share}% of the ${n(x.liveJobs)} live jobs on NextChapter ask for an AI skill`] : []),
    ],
    action: 'Look at which AI skills your target role asks for, and build the one it names most',
    source: `NextChapter job board, ${x.asOf}`,
    path: '/ai-skills',
    subreddits: ['careerguidance', 'jobs', 'ExperiencedDevs'],
    hashtags: ['AI', 'salary', 'careers'],
  }
}

export interface EntryInput { entry: number; liveUs: number; noExp: number; training: number | null; asOf: string }

export function entryCard(x: EntryInput): Card {
  const share = x.liveUs ? Math.round((100 * x.entry) / x.liveUs) : 0
  return {
    kind: 'market', subject: 'entry',
    headline: `${n(x.entry)} entry-level and early-career professional jobs are open right now`,
    big: n(x.entry), bigLabel: 'entry and early-career jobs open',
    points: [
      `That is ${share}% of the ${n(x.liveUs)} live US jobs on NextChapter`,
      `${n(x.noExp)} of them say no experience is needed`,
      ...(x.training ? [`${n(x.training)} describe a training program for new hires`] : []),
    ],
    action: 'Filter the board to entry level and read the ones that say no experience is needed first',
    source: `NextChapter job board, ${x.asOf}`,
    path: '/jobs',
    subreddits: ['jobs', 'careerguidance', 'resumes'],
    hashtags: ['entrylevel', 'jobsearch', 'hiring'],
  }
}

export interface SeniorInput { n: number; aiSkill: number; sharePct: number; asOf: string }

export function seniorCard(x: SeniorInput): Card {
  const pct = Math.round(x.sharePct)
  return {
    kind: 'market', subject: 'senior',
    headline: `${pct}% of director-level and VP-level jobs now ask for a specific AI skill`,
    big: `${pct}%`, bigLabel: 'of director and VP jobs ask for an AI skill',
    points: [
      `${n(x.aiSkill)} of ${n(x.n)} director, VP and above postings with a full job description name an AI skill`,
      'It counts a named AI skill or tool, not a passing mention of AI',
    ],
    action: 'Add the AI skill your target roles name to your leadership story with one concrete result',
    source: `NextChapter job board, ${x.asOf}`,
    path: '/ai-skills',
    subreddits: ['careerguidance', 'jobs', 'ExperiencedDevs'],
    hashtags: ['leadership', 'AI', 'executivesearch'],
  }
}

export interface DeadlineInput {
  /** The last day of work the card counts from (a layoff's effective date), or null for the general card. */
  lastDay: Date | null
  employer: string | null
  state: string | null
}

export function deadlineCard(x: DeadlineInput): Card {
  const fileBy = x.lastDay ? addDays(x.lastDay, 2) : null
  const windows = x.lastDay ? addDays(x.lastDay, 60) : null
  const headline = x.lastDay && x.employer
    ? `Laid off from ${x.employer} on ${day(x.lastDay)}? File for unemployment by ${day(fileBy!)}`
    : 'Laid off this week? File for unemployment in the first two days'
  const points = [
    'In most states you cannot be paid for the weeks before you file, so file now, even if you expect severance',
    x.lastDay && windows
      ? `COBRA and a Marketplace plan each usually have a 60-day window, which counted from ${day(x.lastDay)} ends ${day(windows)}`
      : 'COBRA and a Marketplace plan each usually have a 60-day window to choose coverage',
  ]
  return {
    kind: 'deadline', subject: x.lastDay ? x.lastDay.toISOString().slice(0, 10) : 'general',
    headline, big: '2 days', bigLabel: 'to file for unemployment after your last day',
    points,
    action: `Get the filing steps${x.state ? ` for ${stateName(x.state)}` : ''} and your dates, then confirm the exact dates on your own paperwork`,
    source: 'Federal COBRA and Marketplace windows; unemployment rules are set by each state',
    path: x.state ? `/unemployment-benefits/${stateSlug(x.state)}` : '/tools/layoff-deadlines',
    subreddits: ['layoffs', 'personalfinance', 'jobs'],
    hashtags: ['layoffs', 'unemployment', 'jobsearch'],
  }
}
