// Facts about a member's situation that make their plan specific: when severance and
// coverage end, how long they were away, a day rate, months of runway. One list drives
// the settings form, what the server accepts and the plan steps, so a question is never
// asked without something reading the answer. Stored in journeyDetails. Pure and
// client-safe.

import type { JourneyType } from '@prisma/client'
import { RETIREMENT_INCOME, RETIREMENT_PATHS, retirementPlanItems } from './retirement'
import { INCOME_NEED_OPTIONS, incomePlanItems, sideIncomeOf } from './paths'

const ALL_JOURNEYS: readonly JourneyType[] = ['LAID_OFF', 'EXPLORING_MOVE', 'GROWING', 'PROMOTION', 'CAREER_CHANGE', 'STUDENT_NEW_GRAD', 'RETURNING', 'NEXT_ACT', 'TIME_OFF', 'FRACTIONAL', 'ENTREPRENEUR', 'BUY_BUSINESS']

export type SituationField = {
  key: string
  journeys: readonly JourneyType[]
  label: string
  kind: 'date' | 'number' | 'choice' | 'text'
  min?: number
  max?: number
  options?: readonly { value: string; label: string }[]
}

export const SITUATION_FIELDS: readonly SituationField[] = [
  {
    key: 'incomeNeed',
    // Not full-time fractional members: their plan already runs on clients and a pipeline.
    journeys: ALL_JOURNEYS.filter((j) => j !== 'FRACTIONAL'),
    label: 'How long could you go without new income?',
    kind: 'choice',
    options: INCOME_NEED_OPTIONS,
  },
  { key: 'hoursAvailable', journeys: ALL_JOURNEYS, label: 'About how many hours a week can you give this?', kind: 'number', min: 1, max: 60 },
  {
    key: 'boardExperience',
    journeys: ['NEXT_ACT'],
    label: 'Your board experience',
    kind: 'choice',
    options: [
      { value: 'NONE', label: 'None yet' },
      { value: 'ADVISORY', label: 'Advisory roles' },
      { value: 'BOARD', label: 'Served on a board' },
    ],
  },
  { key: 'boardSectors', journeys: ['NEXT_ACT'], label: 'Sectors you would serve (for example health, education, finance)', kind: 'text' },
  {
    key: 'retirementPath',
    journeys: ['NEXT_ACT', 'GROWING'],
    label: 'If you step back from full-time work, which feels closest?',
    kind: 'choice',
    options: RETIREMENT_PATHS,
  },
  { key: 'retirementBy', journeys: ['NEXT_ACT', 'GROWING'], label: 'About when? (optional)', kind: 'date' },
  { key: 'retirementIncome', journeys: ['NEXT_ACT', 'GROWING'], label: 'How much income do you still want?', kind: 'choice', options: RETIREMENT_INCOME },
  { key: 'clientCount', journeys: ['FRACTIONAL'], label: 'How many clients do you have now?', kind: 'number', min: 0, max: 50 },
  { key: 'severanceEnds', journeys: ['LAID_OFF'], label: 'When does your severance pay end?', kind: 'date' },
  { key: 'benefitsEnd', journeys: ['LAID_OFF'], label: 'When does your health coverage end?', kind: 'date' },
  { key: 'monthlyNeed', journeys: ['LAID_OFF'], label: 'About how much do you need each month, in dollars?', kind: 'number', min: 500, max: 100000 },
  { key: 'noticeWeeks', journeys: ['EXPLORING_MOVE'], label: 'How many weeks of notice would you give?', kind: 'number', min: 0, max: 26 },
  { key: 'moveBy', journeys: ['EXPLORING_MOVE'], label: 'Move by (optional)', kind: 'date' },
  { key: 'breakMonths', journeys: ['RETURNING'], label: 'How many months were you away?', kind: 'number', min: 1, max: 240 },
  {
    key: 'returnHours',
    journeys: ['RETURNING'],
    label: 'What hours are you looking for?',
    kind: 'choice',
    options: [
      { value: 'FULL', label: 'Full time' },
      { value: 'PART', label: 'Part time' },
      { value: 'FLEX', label: 'Flexible' },
    ],
  },
  { key: 'dayRate', journeys: ['NEXT_ACT', 'FRACTIONAL'], label: 'Your day rate, in dollars', kind: 'number', min: 100, max: 20000 },
  { key: 'hoursPerWeek', journeys: ['NEXT_ACT'], label: 'Hours a week you want to work', kind: 'number', min: 1, max: 40 },
  { key: 'runwayMonths', journeys: ['ENTREPRENEUR'], label: 'About how many months of runway do you have?', kind: 'number', min: 0, max: 120 },
  { key: 'payEnds', journeys: ['TIME_OFF'], label: 'When does your leave pay or coverage end? (optional)', kind: 'date' },
]

const DATE = /^\d{4}-\d{2}-\d{2}$/

// A value the form sent, made safe. Blank or invalid means "leave it as it is".
export function parseSituationValue(f: SituationField, raw: string): string | number | null {
  const v = raw.trim()
  if (!v) return null
  if (f.kind === 'date') return DATE.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime()) ? v : null
  if (f.kind === 'text') return v.slice(0, 120)
  if (f.kind === 'number') {
    const n = Number(v)
    return Number.isFinite(n) && Number.isInteger(n) && n >= (f.min ?? 0) && n <= (f.max ?? Number.MAX_SAFE_INTEGER) ? n : null
  }
  return f.options?.some((o) => o.value === v) ? v : null
}

export function situationFieldsFor(journey: JourneyType | null): SituationField[] {
  return journey ? SITUATION_FIELDS.filter((f) => f.journeys.includes(journey)) : []
}

const DAY = 86_400_000
const weeksText = (days: number) => (days <= 7 ? 'about a week' : `${Math.round(days / 7)} weeks`)

export type SituationPlanItem = { text: string; actionType?: string }

export function situationPlanItems(journey: JourneyType | null, details: unknown, opts: { fn?: string | null; now?: Date; kinds?: readonly string[] | null; senior?: boolean } = {}): SituationPlanItem[] {
  if (!journey) return []
  const d = (details ?? {}) as Record<string, unknown>
  const now = opts.now ?? new Date()
  const daysTo = (key: string) => (typeof d[key] === 'string' && DATE.test(d[key] as string) ? Math.ceil((new Date(`${d[key]}T12:00:00Z`).getTime() - now.getTime()) / DAY) : null)
  const num = (key: string) => (typeof d[key] === 'number' ? (d[key] as number) : null)
  const out: SituationPlanItem[] = []
  // How long they could go without income: what comes first, by their answer, unless they already earn that way.
  out.push(...incomePlanItems({ details: d, main: journey, kinds: opts.kinds, workingNow: d.workingNow === true, now, senior: opts.senior }))
  const hours = num('hoursAvailable')
  if (hours !== null && hours <= 3) out.push({ text: `You have about ${hours} hours a week: do only the first two steps this week and leave the rest` })
  if (journey === 'NEXT_ACT') {
    if (d.boardExperience === 'NONE') out.push({ text: 'Join one nonprofit committee or advisory group to build board experience' })
    if (d.boardExperience === 'ADVISORY') out.push({ text: 'Ask an organization you advised to introduce you to its board' })
    if (d.boardExperience === 'BOARD') out.push({ text: 'Ask a board chair you served with for a reference you can use with new boards', actionType: 'REFERENCE_REQUESTED' })
    if (typeof d.boardSectors === 'string' && d.boardSectors.trim()) out.push({ text: `List 10 boards in ${d.boardSectors.trim()} that you would serve`, actionType: 'WATCHLIST_ADD' })
  }
  if (journey === 'NEXT_ACT' || journey === 'GROWING') out.push(...retirementPlanItems(d, now))
  if (journey === 'FRACTIONAL') {
    const clients = num('clientCount')
    if (clients === 0) out.push({ text: 'Land your first client: offer a scoped first engagement to your warmest contact', actionType: 'OUTREACH_CALL' })
    else if (clients !== null && clients <= 2) out.push({ text: `You rely on ${clients} client${clients === 1 ? '' : 's'}: start one new conversation to spread the risk`, actionType: 'OUTREACH_CALL' })
  }
  if (journey === 'LAID_OFF') {
    const sev = daysTo('severanceEnds')
    if (sev !== null && sev >= 0 && sev <= 70) out.push({ text: `Your severance ends in ${weeksText(sev)}: work out what you will live on after that date` })
    const ben = daysTo('benefitsEnd')
    if (ben !== null && ben >= 0 && ben <= 60) out.push({ text: `Your health coverage ends in ${weeksText(ben)}: price COBRA against the marketplace and decide before the deadline` })
    const need = num('monthlyNeed')
    if (need) out.push({ text: `You need about $${need.toLocaleString('en-US')} a month: divide your savings and severance by it to know how many months you have` })
    // Side or part-time income the member told us about counts against that need.
    const side = sideIncomeOf(d)
    if (need && side > 0) {
      out.push({ text: `Your side income covers about $${Math.min(side, need).toLocaleString('en-US')} of the $${need.toLocaleString('en-US')} you need each month${side >= need ? ': your runway is no longer shrinking' : `: the gap is $${(need - side).toLocaleString('en-US')}`}` })
    }
  }
  if (journey === 'EXPLORING_MOVE') {
    const by = daysTo('moveBy')
    if (by !== null && by > 0 && by <= 150) out.push({ text: `You want to move within ${weeksText(by)}: work back from that date and put the offer deadline on your calendar` })
    const notice = num('noticeWeeks')
    if (notice !== null && notice >= 4) out.push({ text: `You would give ${notice} weeks of notice: tell target employers your earliest start date early` })
  }
  if (journey === 'RETURNING') {
    const months = num('breakMonths')
    if (months && months >= 12) out.push({ text: `After ${months} months away, refresh one skill that changed while you were gone`, actionType: 'LEARNING_MODULE' })
    if (d.returnHours === 'PART' || d.returnHours === 'FLEX') out.push({ text: 'Look at part-time, contract and returnship roles: they are the usual way back in when you want flexible hours' })
  }
  if (journey === 'NEXT_ACT' || journey === 'FRACTIONAL') {
    const rate = num('dayRate')
    if (rate) out.push({ text: `Check your $${rate.toLocaleString('en-US')} day rate against what ${opts.fn ?? 'your'} advisory and fractional work pays` })
  }
  if (journey === 'NEXT_ACT') {
    const hours = num('hoursPerWeek')
    if (hours) out.push({ text: `You want about ${hours} hours a week: sketch the two or three engagements that would fill them` })
  }
  if (journey === 'ENTREPRENEUR') {
    const runway = num('runwayMonths')
    if (runway !== null && runway <= 6) out.push({ text: `You have about ${runway} months of runway: decide the date by which you would take contract work` })
  }
  if (journey === 'TIME_OFF') {
    const pay = daysTo('payEnds')
    if (pay !== null && pay >= 0 && pay <= 56) out.push({ text: `Your leave pay or coverage ends in ${weeksText(pay)}: confirm what happens next` })
  }
  return out
}
