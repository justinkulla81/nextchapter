// The insider culture survey: the questions, their 3-point scales, and the matching
// "what you want" questions. Pure and client-safe — the survey form, the preferences
// form, the company page bars and the per-job match all read this one definition.
//
// Every answer is 1, 2 or 3 on the dimension's scale. Preferences use the same scale,
// plus 0 = "No preference". Structured answers only: there is no free text anywhere in
// this survey, so nothing needs (LLM) moderation and nothing can name a person.
//
// direction:
//   'match'  — either way can be a mismatch (a steady pace is as wrong for someone who
//              wants intense as the reverse).
//   'atMost' — only a company ABOVE what the member wants is a gap (wanting little
//              manager support is not hurt by a company that gives a lot).

export type CultureDimensionKey =
  | 'pace'
  | 'structure'
  | 'workLife'
  | 'remoteReality'
  | 'decisions'
  | 'managerSupport'
  | 'mission'
  | 'growth'

export type CultureAnswers = Partial<Record<CultureDimensionKey, number | null>>

export interface CultureDimension {
  key: CultureDimensionKey
  /** Survey question about the company, for people who worked there. */
  question: string
  /** Button labels, scale 1..3. */
  options: [string, string, string]
  /** Short heading for the company page bars. */
  label: string
  /** "...describe {subject} as {describe}". */
  subject: string
  describe: [string, string, string]
  /** The member's own preference. Null for remoteReality (CandidateProfile.remotePreference holds it). */
  prefQuestion: string | null
  prefOptions: [string, string, string] | null
  /** "...; you {prefPhrase}". */
  prefPhrase: [string, string, string]
  direction: 'match' | 'atMost'
  /** Constructive interview question when insiders and the member disagree. */
  ask: string
}

export const CULTURE_DIMENSIONS: CultureDimension[] = [
  {
    key: 'pace',
    question: "What's the pace like?",
    options: ['Steady', 'A mix', 'Intense'],
    label: 'Pace',
    subject: 'the pace',
    describe: ['steady', 'a mix of steady and intense', 'intense'],
    prefQuestion: 'What pace do you want?',
    prefOptions: ['Steady', 'A mix', 'Intense'],
    prefPhrase: ['prefer steady', 'prefer a mix', 'prefer intense'],
    direction: 'match',
    ask: 'ask what a normal week looks like on this team',
  },
  {
    key: 'structure',
    question: 'How is work organized?',
    options: ['Clear processes', 'Some of both', 'Figure it out'],
    label: 'How work is organized',
    subject: 'how work gets done',
    describe: ['process-driven', 'a mix of process and figuring it out', 'figure-it-out-as-you-go'],
    prefQuestion: 'How do you like work organized?',
    prefOptions: ['Clear processes', 'Some of both', 'Figure it out'],
    prefPhrase: ['prefer clear processes', 'prefer some of both', 'prefer figuring it out'],
    direction: 'match',
    ask: 'ask how much of the role is defined and how much you would shape yourself',
  },
  {
    key: 'workLife',
    question: 'How is work-life balance?',
    options: ['Protected', 'Depends on the team', 'Always on'],
    label: 'Work-life balance',
    subject: 'work-life balance',
    describe: ['protected', 'dependent on the team', 'always on'],
    prefQuestion: 'How much does work-life balance matter to you?',
    prefOptions: ['Must be protected', 'Some give and take', 'I put in what it takes'],
    prefPhrase: ['want it protected', 'want some give and take', "don't mind long hours"],
    direction: 'atMost',
    ask: 'ask how the team handles evenings, weekends and busy seasons',
  },
  {
    key: 'remoteReality',
    question: 'Where does work really happen, whatever the policy says?',
    options: ['Mostly remote', 'Hybrid', 'Mostly in the office'],
    label: 'Where work really happens',
    subject: 'where work really happens',
    describe: ['mostly remote', 'hybrid', 'mostly in the office'],
    prefQuestion: null,
    prefOptions: null,
    prefPhrase: ['prefer remote', 'prefer hybrid', 'prefer on-site'],
    direction: 'atMost',
    ask: 'ask how many days people are really in the office',
  },
  {
    key: 'decisions',
    question: 'How are decisions made?',
    options: ['Top-down', 'A mix', 'Collaborative'],
    label: 'Decisions',
    subject: 'decisions',
    describe: ['top-down', 'a mix of top-down and shared', 'collaborative'],
    prefQuestion: 'How do you like decisions made?',
    prefOptions: ['Top-down', 'A mix', 'Collaborative'],
    prefPhrase: ['prefer clear top-down calls', 'prefer a mix', 'prefer collaborative decisions'],
    direction: 'match',
    ask: 'ask how this team makes decisions',
  },
  {
    key: 'managerSupport',
    question: 'How much feedback and support do managers give?',
    options: ['A lot', 'It varies', 'Little'],
    label: 'Manager support',
    subject: 'manager support and feedback',
    describe: ['strong', 'uneven', 'thin'],
    prefQuestion: 'How much manager support do you want?',
    prefOptions: ['A lot', 'Some', 'Little — I work independently'],
    prefPhrase: ['want a lot of support', 'want some support', 'work independently'],
    direction: 'atMost',
    ask: 'ask how often you would meet with your manager and how feedback works',
  },
  {
    key: 'mission',
    question: 'How much does the mission drive the work?',
    options: ['A lot', 'Somewhat', 'Not much'],
    label: 'Mission',
    subject: 'the mission',
    describe: ['central to the work', 'somewhat important', 'not a big factor'],
    prefQuestion: 'How much does the mission matter to you?',
    prefOptions: ['A lot', 'Somewhat', 'Not much'],
    prefPhrase: ['want a mission-driven place', 'want some mission', "don't need a mission focus"],
    direction: 'atMost',
    ask: 'ask how the mission shows up in day-to-day decisions',
  },
  {
    key: 'growth',
    question: 'Is there room to grow and get promoted?',
    options: ['A clear path', 'Possible', 'Limited'],
    label: 'Room to grow',
    subject: 'room to grow',
    describe: ['clear', 'possible but not clear', 'limited'],
    prefQuestion: 'How important is room to grow?',
    prefOptions: ['Very', 'Somewhat', 'Not a priority'],
    prefPhrase: ['want a clear path up', 'want some room to grow', "aren't focused on promotion"],
    direction: 'atMost',
    ask: 'ask how the last few people in this role grew or were promoted',
  },
]

export const CULTURE_DIMENSION_BY_KEY = Object.fromEntries(CULTURE_DIMENSIONS.map((d) => [d.key, d])) as Record<
  CultureDimensionKey,
  CultureDimension
>
export const CULTURE_KEYS = CULTURE_DIMENSIONS.map((d) => d.key)
/** Preference dimensions (all but remoteReality, which lives on the profile). */
export const CULTURE_PREF_DIMENSIONS = CULTURE_DIMENSIONS.filter((d) => d.prefQuestion !== null)
export const CULTURE_PREF_KEYS = CULTURE_PREF_DIMENSIONS.map((d) => d.key)

/** At least this many members (besides the viewer) before a company's culture is shown. */
export const CULTURE_MIN_RESPONDENTS = 3

/** Keep only valid 1..3 answers for known survey keys. */
export function cleanCultureAnswers(input: unknown): Partial<Record<CultureDimensionKey, number>> {
  const out: Partial<Record<CultureDimensionKey, number>> = {}
  if (!input || typeof input !== 'object') return out
  for (const k of CULTURE_KEYS) {
    const v = (input as Record<string, unknown>)[k]
    if (v === 1 || v === 2 || v === 3) out[k] = v
  }
  return out
}

/** Keep only valid 0..3 preferences (0 = no preference) for preference keys. */
export function cleanCulturePreferences(input: unknown): Partial<Record<CultureDimensionKey, number>> {
  const out: Partial<Record<CultureDimensionKey, number>> = {}
  if (!input || typeof input !== 'object') return out
  for (const k of CULTURE_PREF_KEYS) {
    const v = (input as Record<string, unknown>)[k]
    if (v === 0 || v === 1 || v === 2 || v === 3) out[k] = v
  }
  return out
}

/** CandidateProfile.remotePreference -> the remoteReality scale (null = no preference / unknown). */
export function remotePreferenceToScale(pref: string | null | undefined): number | null {
  if (pref === 'remote') return 1
  if (pref === 'hybrid') return 2
  if (pref === 'onsite') return 3
  return null
}
