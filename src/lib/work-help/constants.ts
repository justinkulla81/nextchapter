// "A hard situation at work": the fixed vocabulary shared by the server actions and the page.

export const WORK_KINDS = [
  { key: 'BOSS', label: 'My boss' },
  { key: 'REPORT', label: 'Someone I manage' },
  { key: 'COWORKER', label: 'A coworker' },
  { key: 'CULTURE', label: 'The workload or culture' },
] as const
export type WorkKind = (typeof WORK_KINDS)[number]['key']
export const isWorkKind = (v: unknown): v is WorkKind => WORK_KINDS.some((k) => k.key === v)

export const MAX_SITUATION_CHARS = 2000
export const MAX_TITLE_CHARS = 140
export const MAX_BODY_CHARS = 1200
export const MAX_REPLY_CHARS = 1500
export const MAX_QUESTIONS_PER_DAY = 3
export const MAX_REPLIES_PER_DAY = 20

// The ways forward the helper can offer. The model picks and words them; it cannot invent new ones, so every
// option has a real place to go.
export const OPTION_CATALOG = {
  document_impact: { title: 'Make your work visible in writing', actionLabel: 'Open my impact log', href: '/dashboard/in-work?tab=impact' },
  talk_directly: { title: 'Talk to them directly', actionLabel: null, href: null },
  escalate_hr: { title: 'Take it to HR or a senior leader', actionLabel: null, href: null },
  internal_move: { title: 'See if a move inside your company helps', actionLabel: 'See internal roles', href: '/dashboard/internal-roles' },
  look_outside: { title: 'Look outside, quietly', actionLabel: 'Review my privacy settings', href: '/dashboard/privacy' },
  coach_session: { title: 'Talk it through with a coach', actionLabel: 'Book a session', href: '/dashboard/book-session' },
} as const
export type OptionKey = keyof typeof OPTION_CATALOG
export const OPTION_KEYS = Object.keys(OPTION_CATALOG) as OptionKey[]

export interface WorkOption {
  key: OptionKey
  title: string
  why: string
  firstStep: string
  actionLabel: string | null
  href: string | null
}

export interface WorkAnalysis {
  acknowledgement: string
  options: WorkOption[]
  needsLegalPointer: boolean
  /** True when the AI was unavailable and these are the standard options. */
  generic: boolean
}

export interface PreparedQuestion {
  title: string
  body: string
  /** Plain labels for what was taken out, e.g. "Your company name". */
  removed: string[]
}

export interface WorkReplyView {
  id: string
  handle: string
  body: string
  createdAt: string
  /** Only on your own question: the reply is yours. */
  mine: boolean
}

export interface WorkQuestionView {
  id: string
  handle: string
  title: string
  body: string
  createdAt: string
  status: 'PUBLISHED' | 'HELD'
  replies: WorkReplyView[]
}

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }
