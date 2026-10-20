// Validation and plan wording for a saved career conversation (a review, raise,
// promotion or offer discussion). Pure; the server action and the page use it.

export const CONVERSATION_KINDS = [
  { key: 'REVIEW', label: 'Performance review' },
  { key: 'RAISE', label: 'Raise' },
  { key: 'PROMOTION', label: 'Promotion' },
  { key: 'OFFER', label: 'Offer' },
] as const
export type ConversationKind = (typeof CONVERSATION_KINDS)[number]['key']

export const OUTCOMES = [
  { key: 'GOT_IT', label: 'I got it' },
  { key: 'PARTIAL', label: 'I got part of it' },
  { key: 'NOT_NOW', label: 'Not now' },
] as const
export type ConversationOutcome = (typeof OUTCOMES)[number]['key']

export type ConversationInput = {
  kind: string
  scheduledFor: string // yyyy-mm-dd or ''
  askAmount: string // digits, with $ and commas allowed, or ''
  askLevel: string
  reasons: string[]
  walkAway: string
}

export type ConversationClean = {
  kind: ConversationKind
  scheduledFor: Date | null
  askAmount: number | null
  askLevel: string | null
  reasons: string[]
  walkAway: string | null
}

export const MAX_ASK = 10_000_000

// Says what went wrong and what to do next, and never throws away what was typed.
export function cleanConversation(input: ConversationInput): { ok: true; value: ConversationClean } | { ok: false; error: string } {
  const kind = CONVERSATION_KINDS.find((k) => k.key === input.kind)?.key
  if (!kind) return { ok: false, error: 'Choose what kind of conversation this is.' }

  let askAmount: number | null = null
  const rawAmount = input.askAmount.replace(/[$,\s]/g, '')
  if (rawAmount) {
    if (!/^\d+$/.test(rawAmount)) return { ok: false, error: 'Enter your ask as a whole number of dollars a year, like 145000.' }
    askAmount = Number(rawAmount)
    if (askAmount <= 0 || askAmount > MAX_ASK) return { ok: false, error: 'That amount does not look right. Enter your ask in dollars a year, like 145000.' }
  }

  let scheduledFor: Date | null = null
  if (input.scheduledFor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledFor)) return { ok: false, error: 'Enter the date as year-month-day, or leave it blank.' }
    const d = new Date(`${input.scheduledFor}T12:00:00Z`)
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'That date does not exist. Check it, or leave it blank.' }
    scheduledFor = d
  }

  const reasons = input.reasons.map((r) => r.trim()).filter(Boolean)
  if (reasons.length > 3) return { ok: false, error: 'Keep it to your three strongest reasons.' }
  if (reasons.some((r) => r.length > 300)) return { ok: false, error: 'Shorten each reason to a sentence or two, under 300 characters.' }
  const askLevel = input.askLevel.trim().slice(0, 120) || null
  const walkAway = input.walkAway.trim() || null
  if (walkAway && walkAway.length > 1000) return { ok: false, error: 'Shorten your walk-away to under 1,000 characters.' }
  if (askAmount === null && !askLevel) return { ok: false, error: 'Add your ask: a number, a title or level, or both.' }
  if (reasons.length === 0) return { ok: false, error: 'Add at least one reason, ideally a result you can point to.' }

  return { ok: true, value: { kind, scheduledFor, askAmount, askLevel, reasons, walkAway } }
}

const DAY = 86_400_000

// A plan item when a conversation is coming up, so the weekly plan says what to
// do about it. Null when nothing is pending in the next two weeks.
export function conversationPlanItem(
  conversations: { kind: string; scheduledFor: Date | null; outcome: string }[],
  now: Date = new Date()
): { text: string } | null {
  const next = conversations
    .filter((c) => c.outcome === 'PENDING' && c.scheduledFor)
    .map((c) => ({ ...c, days: Math.ceil((c.scheduledFor!.getTime() - now.getTime()) / DAY) }))
    .filter((c) => c.days >= 0 && c.days <= 14)
    .sort((a, b) => a.days - b.days)[0]
  if (!next) return null
  const label = CONVERSATION_KINDS.find((k) => k.key === next.kind)?.label.toLowerCase() ?? 'conversation'
  const when = next.days === 0 ? 'today' : next.days === 1 ? 'tomorrow' : `in ${next.days} days`
  return { text: `Your ${label} conversation is ${when}: say your ask and your three reasons out loud once, start to finish` }
}
