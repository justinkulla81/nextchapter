// Stepping back from full-time work, as a path rather than a cliff. Pure and client-safe.
// It rides on the journeys people in later career already use (Next act, Managing my career): the
// member says which of four paths feels right, and optionally when and how much income they still
// need. Nothing here asks for or uses age. "Retire" is one of four answers, not the assumption.

export const RETIREMENT_PATHS = [
  { value: 'ENCORE', label: 'An encore: new kind of work' },
  { value: 'PHASED', label: 'Cut back gradually' },
  { value: 'STOP', label: 'Stop working' },
  { value: 'UNSURE', label: 'Not sure yet' },
] as const
export type RetirementPath = (typeof RETIREMENT_PATHS)[number]['value']

export const RETIREMENT_INCOME = [
  { value: 'NONE', label: 'I do not need income' },
  { value: 'SOME', label: 'Some income helps' },
  { value: 'FULL', label: 'I need full income' },
] as const
export type RetirementIncome = (typeof RETIREMENT_INCOME)[number]['value']

export type Retirement = { path: RetirementPath; by: string | null; income: RetirementIncome | null }

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function retirementOf(details: unknown): Retirement | null {
  const d = (details ?? {}) as Record<string, unknown>
  const path = RETIREMENT_PATHS.find((p) => p.value === d.retirementPath)?.value
  if (!path) return null
  const income = RETIREMENT_INCOME.find((i) => i.value === d.retirementIncome)?.value ?? null
  const by = typeof d.retirementBy === 'string' && DATE.test(d.retirementBy) ? d.retirementBy : null
  return { path, by, income }
}

const DAY = 86_400_000

export type RetirementPlanItem = { text: string; actionType?: string }

// Plan steps for the path they chose. Few, specific, and dated only when they gave a date.
export function retirementPlanItems(details: unknown, now = new Date()): RetirementPlanItem[] {
  const r = retirementOf(details)
  if (!r) {
    // A date or an income need without a path: ask the one question that unlocks the rest.
    const d = (details ?? {}) as Record<string, unknown>
    return d.retirementBy || d.retirementIncome ? [{ text: 'Choose which way of stepping back feels closest (Privacy > your situation) and your plan gets specific' }] : []
  }
  const out: RetirementPlanItem[] = []
  const months = r.by ? Math.round((new Date(`${r.by}T12:00:00Z`).getTime() - now.getTime()) / (30.44 * DAY)) : null
  const when = months !== null && months > 0 && months <= 60 ? ` You said about ${months} ${months === 1 ? 'month' : 'months'} from now.` : ''
  switch (r.path) {
    case 'ENCORE':
      out.push({ text: `Write down what you want more of in your next chapter: people, causes, flexibility or learning.${when}` })
      out.push({ text: 'Have one conversation with someone who built an encore you admire', actionType: 'OUTREACH_CALL' })
      break
    case 'PHASED':
      out.push({ text: `Sketch how you would like your hours to taper, and what you would hand over first.${when}` })
      out.push({ text: 'Find out how your employer handles reduced hours, a consulting arrangement or a phased exit' })
      break
    case 'STOP':
      out.push({ text: `List what stepping back needs to cover each month, and where it comes from.${when}` })
      out.push({ text: 'Check how your health coverage works after your last day, and what you would need to decide before then' })
      break
    case 'UNSURE':
      out.push({ text: 'Try stepping back on paper: use the pause tool on your career story to see how a few months would line up' })
      break
  }
  if (r.income === 'SOME' || r.income === 'FULL') out.push({ text: r.income === 'FULL' ? 'You need full income: look at the paths that keep it, such as consulting, interim or a phased exit with a pay arrangement' : 'You would like some income: look at part-time, advisory and fractional work', actionType: 'INTERIM_PROFILE_CREATED' })
  return out
}
