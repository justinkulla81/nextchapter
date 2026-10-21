// Plain-words helpers for the Network and Account pages after the old cards were replaced
// (docs/redesign-old-card-audit-network-account.md). Each one turns what used to be a badge, a tag or a boxed
// status into a sentence that says what is true and why it matters. Pure, so they are tested without the database.

// ---- Contacts ---------------------------------------------------------------------------------------------------

export type ContactScope = 'mine' | 'nextchapter' | 'all'

export const CONTACT_SCOPES: { key: ContactScope; label: string; href: string }[] = [
  { key: 'mine', label: 'Your contacts', href: '/dashboard/network/contacts' },
  { key: 'nextchapter', label: 'NextChapter members', href: '/dashboard/network/contacts?scope=nextchapter' },
  { key: 'all', label: 'Everyone', href: '/dashboard/network/contacts?scope=all' },
]

export const CONTACT_SORT_KEYS = ['name', 'company', 'date', 'priority'] as const
export type ContactSortKey = (typeof CONTACT_SORT_KEYS)[number]

export const CONTACT_SORT_CHOICES: { value: ContactSortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'company', label: 'Company' },
  { value: 'date', label: 'Date connected' },
  { value: 'priority', label: 'Starred first' },
]

export type YesNoAll = 'all' | 'yes' | 'no'

export interface ContactListState {
  q: string
  sort: ContactSortKey
  dir: 'asc' | 'desc'
  /** Starred people on top. */
  pin: boolean
  email: 'all' | 'has' | 'missing'
  reached: YesNoAll
  rel: YesNoAll
  nc: YesNoAll
  page: number
}

export const DEFAULT_CONTACT_LIST: ContactListState = { q: '', sort: 'name', dir: 'asc', pin: true, email: 'all', reached: 'all', rel: 'all', nc: 'all', page: 1 }

/** The address of the contact list for a state, leaving every default out so the URL stays short and shareable. */
export function contactsHref(state: ContactListState, overrides: Partial<ContactListState> = {}): string {
  const next = { ...state, ...overrides }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.sort !== 'name') params.set('sort', next.sort)
  if (next.dir !== 'asc') params.set('dir', next.dir)
  if (!next.pin) params.set('pin', '0')
  if (next.email !== 'all') params.set('email', next.email)
  if (next.reached !== 'all') params.set('reached', next.reached)
  if (next.rel !== 'all') params.set('rel', next.rel)
  if (next.nc !== 'all') params.set('nc', next.nc)
  if (next.page !== 1) params.set('page', String(next.page))
  const qs = params.toString()
  return `/dashboard/network/contacts${qs ? `?${qs}` : ''}`
}

/** How many filters are narrowing the list, so the filter control can say so instead of hiding it. */
export function activeContactFilters(state: ContactListState): number {
  return [state.email !== 'all', state.reached !== 'all', state.rel !== 'all', state.nc !== 'all'].filter(Boolean).length
}

const CHANNEL_WORD: Record<string, string> = { EMAIL: 'email', LINKEDIN: 'LinkedIn message', PHONE: 'phone call', TEXT: 'text', MEETING: 'meeting' }

/** Month, day and year, the same wherever the server runs. */
export function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export interface ContactFactInput {
  hasReachedOut: boolean
  lastOutreachChannel: string | null
  lastOutreachAt: Date | null
  connectedAt: Date | null
  isAtCurrentEmployer: boolean
}

/** The one fact on a contact row: when you last wrote, or that you have not yet. A same-employer contact says so. */
export function contactFact(c: ContactFactInput): string {
  const base = c.hasReachedOut
    ? `You reached out${c.lastOutreachChannel ? ` by ${CHANNEL_WORD[c.lastOutreachChannel] ?? c.lastOutreachChannel.toLowerCase()}` : ''}${c.lastOutreachAt ? ` on ${shortDate(c.lastOutreachAt)}` : ''}.`
    : c.connectedAt
      ? `Not contacted yet. Connected ${shortDate(c.connectedAt)}.`
      : 'Not contacted yet.'
  return c.isAtCurrentEmployer ? `${base} Works at your current employer, so write with care.` : base
}

/** The reach-out history on a contact's page: how many times, and the latest. */
export function outreachHistory(c: { outreachCount: number; lastOutreachChannel: string | null; lastOutreachAt: Date | null }): string {
  if (c.outreachCount === 0) return 'You have not reached out yet.'
  const latest = c.lastOutreachAt ? `, most recently${c.lastOutreachChannel ? ` by ${CHANNEL_WORD[c.lastOutreachChannel] ?? c.lastOutreachChannel.toLowerCase()}` : ''} on ${shortDate(c.lastOutreachAt)}` : ''
  return `You have reached out ${c.outreachCount} ${c.outreachCount === 1 ? 'time' : 'times'}${latest}.`
}

export interface ContactWhyInput {
  title: string | null
  company: string | null
  inferredCompany?: string | null
  membershipLabel?: string | null
  relationshipLabels?: string[]
}

/** Who this person is to you, in one line: their role, then how they connect to you. */
export function contactWhy(c: ContactWhyInput): string | undefined {
  const employer = c.company ?? c.inferredCompany ?? null
  const role = [c.title, employer].filter(Boolean).join(' at ')
  // A relationship that only repeats the membership ("Recruiter" and "Recruiter on NextChapter") is said once.
  const labels = (c.relationshipLabels ?? []).filter((l) => l.toLowerCase() !== (c.membershipLabel ?? '').toLowerCase())
  const parts = [role, c.membershipLabel ? `${c.membershipLabel} on NextChapter` : null, labels.length > 0 ? labels.join(', ') : null].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

// ---- Community ---------------------------------------------------------------------------------------------------

/** A circle switch that carries its unread count in words, not in a badge. */
export function relationLabel(label: string, unread: number): string {
  return unread > 0 ? `${label} (${unread} new)` : label
}

/** Why a message thread is worth opening, said as a fact. */
export function threadFact(unread: boolean, partnerKind: string | null): string | undefined {
  if (unread) return 'New reply waiting'
  return partnerKind ?? undefined
}

/** A post kind in sentence case, or nothing for the plain "Update" kind. */
export function postKind(label: string | undefined, isPlainUpdate: boolean): string | null {
  if (!label || isPlainUpdate) return null
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
}

export type ModerationStatus = 'PENDING' | 'PUBLISHED' | 'HELD' | 'REMOVED'

/** What a member is told about their own post while a moderator has it. Others never see these. */
export function moderationNote(status: ModerationStatus, isOwnPost: boolean): string | null {
  if (!isOwnPost) return null
  if (status === 'HELD') return 'A moderator is reviewing this. Only you can see it until they decide.'
  if (status === 'REMOVED') return 'A moderator removed this, so only you can see it.'
  return null
}

/** Where and what a post is about, as one fact. */
export function postFact(parts: (string | null | undefined)[]): string | undefined {
  const text = parts.filter(Boolean).join(' · ')
  return text || undefined
}

// ---- Coach matching ----------------------------------------------------------------------------------------------

export const COACH_GENDER_CHOICES = [
  { value: '', label: 'No preference' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'nonbinary', label: 'Non-binary' },
] as const

export const COACH_FEEDBACK_CHOICES = [
  { value: '', label: 'No preference' },
  { value: 'direct', label: 'Direct' },
  { value: 'context_first', label: 'Context first' },
] as const

export const COACH_FEEDBACK_HINT: Record<string, string> = {
  '': 'We match on everything else.',
  direct: 'Tell me straight, right away.',
  context_first: 'Walk me through the reasoning before critical feedback.',
}

/** One coach row: the lead reason sits under the name, the rest open on demand. */
export function coachReasons(reasons: string[]): { lead: string | null; rest: string[] } {
  return { lead: reasons[0] ?? null, rest: reasons.slice(1) }
}

// ---- Privacy and connected accounts ------------------------------------------------------------------------------

export type GoogleConnectionStatus = 'connected' | 'expired' | 'not_connected'

/** The state of the Google connection as a sentence, with the one thing to do about it. No coloured pill. */
export function googleConnectionLine(gmail: GoogleConnectionStatus, calendar: GoogleConnectionStatus): { text: string; needsAction: boolean } {
  if (gmail === 'connected' && calendar === 'connected') return { text: 'Connected. Your activity counts automatically.', needsAction: false }
  if (gmail === 'expired' || calendar === 'expired') return { text: 'Needs reconnecting. We stopped reading until you do, so new activity is not counting.', needsAction: true }
  if (gmail === 'not_connected' && calendar === 'not_connected') return { text: 'Not connected. Your applications, replies and interviews will not count on their own.', needsAction: true }
  return { text: `${gmail === 'connected' ? 'Calendar' : 'Gmail'} is not connected, so part of your activity is not counting.`, needsAction: true }
}

/** Whether a privacy tier is open enough to post in the community, and the sentence that says so. */
export function communityAccessLine(tier: string): { canPost: boolean; text: string } {
  const canPost = tier === 'PUBLIC' || tier === 'SEMI_PUBLIC'
  return {
    canPost,
    text: canPost ? 'This lets you post, comment and send encouragement in the community.' : 'You can still use every job tool. Posting in the community needs a Public or Semi-Public profile.',
  }
}

// ---- Documents -------------------------------------------------------------------------------------------------------

export type DocStatus = 'REQUESTED' | 'UPLOADED' | 'ACCEPTED' | 'NEEDS_CHANGES' | 'CANCELLED'

/** One verdict and its reason for a document request, said as what happens next instead of as a status badge. */
export function documentVerdict(status: DocStatus, reviewNote: string | null, overdue: boolean): { verdict: string; why: string } {
  switch (status) {
    case 'REQUESTED':
      return { verdict: overdue ? 'This is overdue.' : 'This needs your file.', why: 'The person who asked cannot move forward until you upload it.' }
    case 'NEEDS_CHANGES':
      return { verdict: 'This needs a new file.', why: reviewNote ? `What needs to change: ${reviewNote}` : 'The reviewer asked for a change.' }
    case 'UPLOADED':
      return { verdict: 'Uploaded.', why: 'It is waiting for review. You can replace the file until it is accepted.' }
    case 'ACCEPTED':
      return { verdict: 'Accepted.', why: 'Nothing more to do.' }
    case 'CANCELLED':
      return { verdict: 'Cancelled.', why: 'The person who asked no longer needs it.' }
  }
}

// ---- Help ---------------------------------------------------------------------------------------------------------------

/** A help conversation's state as words. */
export function conversationState(replyWaiting: boolean, resolved: boolean): string {
  if (replyWaiting) return 'Reply waiting'
  return resolved ? 'Resolved' : 'We are on it'
}

// ---- Benefits network ---------------------------------------------------------------------------------------------

/** The six facts about an offer as one line, so they stop being six grey pills. */
export function listingFacts(l: { function: string; level: string; format: string; costType: string; timeCommitment: string; credentialType: string; seatCount?: number | null }): string {
  const facts = [l.function, l.level, l.format, l.costType, l.timeCommitment, l.credentialType]
  if (l.seatCount != null) facts.push(`${l.seatCount} ${l.seatCount === 1 ? 'seat' : 'seats'}`)
  return facts.join(' · ')
}

export function ratingText(avg: number | null, count: number): string | null {
  if (avg == null) return null
  return `${avg.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}`
}
