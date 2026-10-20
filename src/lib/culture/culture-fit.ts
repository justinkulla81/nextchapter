// Company culture and working environment, as part of Search Strategy.
// One gate question: how much does it matter? If it does not, nothing more is
// asked and nothing is added to the plan. If it does, a few short questions say
// what they want, and those answers become questions to ask in interviews,
// checks on an offer, plan steps and context for the report and fit checks.
// Stored in CandidateProfile.cultureFit. Pure and client-safe.

export const IMPORTANCE = [
  { key: 'NOT_IMPORTANT', label: 'Not important' },
  { key: 'SOMEWHAT', label: 'Somewhat important' },
  { key: 'VERY', label: 'Very important' },
] as const
export type Importance = (typeof IMPORTANCE)[number]['key']

export type DimensionKey = 'pace' | 'structure' | 'collaboration' | 'management' | 'hours' | 'growth'

export type Dimension = {
  key: DimensionKey
  question: string
  options: readonly [
    { key: string; label: string; ask: string },
    { key: string; label: string; ask: string },
  ]
}

// Two choices each, so the options sit side by side. Leaving one blank means no preference.
export const DIMENSIONS: readonly Dimension[] = [
  {
    key: 'pace',
    question: 'How fast do you like to work?',
    options: [
      { key: 'FAST', label: 'Fast and scrappy', ask: 'How quickly do priorities change here, and how does the team handle it?' },
      { key: 'STEADY', label: 'Steady and well planned', ask: 'How far ahead are goals planned, and how often do those plans change?' },
    ],
  },
  {
    key: 'structure',
    question: 'How much structure do you want?',
    options: [
      { key: 'STRUCTURED', label: 'Clear processes and roles', ask: 'How are roles and decisions defined? Can I see how the team works day to day?' },
      { key: 'FLEXIBLE', label: 'Flexible, I figure it out', ask: 'How much of this role is still being defined, and who decides?' },
    ],
  },
  {
    key: 'collaboration',
    question: 'How do you like to work with others?',
    options: [
      { key: 'TEAM', label: 'Lots of teamwork', ask: 'How do people work together day to day, and how much of that is in meetings?' },
      { key: 'INDEPENDENT', label: 'Independent, with focus time', ask: 'How much of the week is uninterrupted time for focused work?' },
    ],
  },
  {
    key: 'management',
    question: 'What kind of manager helps you most?',
    options: [
      { key: 'HANDS_ON', label: 'Close support and feedback', ask: 'How often do managers give feedback, and how often are one-to-ones?' },
      { key: 'AUTONOMOUS', label: 'Trust and space', ask: 'How much freedom do people have in how they do the work, and how is it checked?' },
    ],
  },
  {
    key: 'hours',
    question: 'What do you need from hours and flexibility?',
    options: [
      { key: 'FLEXIBLE_HOURS', label: 'Flexible hours, judged on results', ask: 'How flexible are hours in practice, and how is performance judged?' },
      { key: 'PREDICTABLE_HOURS', label: 'Predictable hours, firm boundaries', ask: 'What does a normal week look like, and how often do people work evenings or weekends?' },
    ],
  },
  {
    key: 'growth',
    question: 'What do you want from the job over time?',
    options: [
      { key: 'GROWTH', label: 'Learning and a clear path up', ask: 'What does a path up look like here, and who was promoted in the last year?' },
      { key: 'STABILITY', label: 'Stability and low turnover', ask: 'How long do people typically stay, and how has the team changed in the last two years?' },
    ],
  },
]

export type CultureFit = {
  importance: Importance
  answers: Partial<Record<DimensionKey, string>>
  mustHave: string | null
  dealBreaker: string | null
}

const MAX_TEXT = 200

export function parseCultureFit(json: unknown): CultureFit | null {
  if (!json || typeof json !== 'object') return null
  const j = json as Record<string, unknown>
  const importance = IMPORTANCE.find((i) => i.key === j.importance)?.key
  if (!importance) return null
  const answers: Partial<Record<DimensionKey, string>> = {}
  const raw = (j.answers ?? {}) as Record<string, unknown>
  for (const d of DIMENSIONS) {
    const v = raw[d.key]
    if (typeof v === 'string' && d.options.some((o) => o.key === v)) answers[d.key] = v
  }
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, MAX_TEXT) : null)
  return { importance, answers, mustHave: text(j.mustHave), dealBreaker: text(j.dealBreaker) }
}

// What the form sends. If culture is not important, nothing else is kept.
export function cleanCultureFit(input: { importance: string | null; answers: Record<string, string | null | undefined>; mustHave?: string | null; dealBreaker?: string | null }): CultureFit | null {
  const importance = IMPORTANCE.find((i) => i.key === input.importance)?.key
  if (!importance) return null
  if (importance === 'NOT_IMPORTANT') return { importance, answers: {}, mustHave: null, dealBreaker: null }
  return parseCultureFit({ importance, answers: input.answers, mustHave: input.mustHave, dealBreaker: input.dealBreaker })
}

export function cultureMatters(fit: CultureFit | null): boolean {
  return !!fit && fit.importance !== 'NOT_IMPORTANT'
}

function chosen(fit: CultureFit): { dim: Dimension; option: Dimension['options'][number] }[] {
  const out: { dim: Dimension; option: Dimension['options'][number] }[] = []
  for (const dim of DIMENSIONS) {
    const o = dim.options.find((x) => x.key === fit.answers[dim.key])
    if (o) out.push({ dim, option: o })
  }
  return out
}

// Plain phrases, for the summary line: "fast and scrappy", "close support and feedback".
export function cultureSummary(fit: CultureFit | null): string[] {
  if (!fit || !cultureMatters(fit)) return []
  return chosen(fit).map((c) => c.option.label.toLowerCase())
}

// Questions to ask an interviewer, from what the member said matters. Empty
// when culture does not matter. Two extra questions come from their own words.
export function interviewQuestions(fit: CultureFit | null): string[] {
  if (!fit || !cultureMatters(fit)) return []
  const qs = chosen(fit).map((c) => c.option.ask)
  if (fit.mustHave) qs.push(`You said "${fit.mustHave}" matters to you: how does it show up here, day to day?`)
  if (fit.dealBreaker) qs.push(`Is there anything here that would run into "${fit.dealBreaker}"?`)
  return qs
}

// Checks to run against an offer before saying yes.
export function offerChecks(fit: CultureFit | null): string[] {
  if (!fit || fit.importance !== 'VERY') return []
  const checks = chosen(fit).map((c) => `Confirm it with someone who works there: ${c.option.label.toLowerCase()}`)
  if (fit.mustHave) checks.push(`Your must-have: ${fit.mustHave}`)
  if (fit.dealBreaker) checks.push(`Your deal breaker: ${fit.dealBreaker}. Make sure it is not in this job`)
  return checks
}

// Plan steps by stage. Only when it matters; "somewhat" gets the interview step only.
export function culturePlanItems(fit: CultureFit | null, stage: string | null): { text: string; actionType?: string }[] {
  if (!fit || !cultureMatters(fit) || !stage) return []
  const out: { text: string; actionType?: string }[] = []
  if (fit.importance === 'VERY' && (stage === 'EXPLORING' || stage === 'PREPARING' || stage === 'APPLYING')) {
    out.push({ text: 'Ask two people who work at a company you are considering what the culture is really like', actionType: 'OUTREACH_CALL' })
  }
  if (stage === 'INTERVIEWING') {
    const dims = cultureSummary(fit).slice(0, 2)
    out.push({ text: `Ask your culture questions in your next interview${dims.length ? ` (${dims.join('; ')})` : ''}` })
  }
  if (fit.importance === 'VERY' && stage === 'OFFER') {
    out.push({ text: 'Check the offer against your culture must-haves before you accept' })
  }
  return out
}

// One line of context for the prompts that write the report, fit checks and
// coaching. Null when culture does not matter, so it never enters a prompt.
export function culturePromptLine(fit: CultureFit | null): string | null {
  if (!fit || !cultureMatters(fit)) return null
  const bits = cultureSummary(fit)
  const parts = [`Company culture and working environment are ${fit.importance === 'VERY' ? 'very' : 'somewhat'} important to this candidate.`]
  if (bits.length) parts.push(`They prefer: ${bits.join('; ')}.`)
  if (fit.mustHave) parts.push(`Must have: ${fit.mustHave}.`)
  if (fit.dealBreaker) parts.push(`Deal breaker: ${fit.dealBreaker}.`)
  return parts.join(' ')
}

// Ready to drop into a prompt: a line break and the context, or nothing at all.
export function cultureContext(json: unknown): string {
  const line = culturePromptLine(parseCultureFit(json))
  return line ? `\nCulture and working environment: ${line}` : ''
}
