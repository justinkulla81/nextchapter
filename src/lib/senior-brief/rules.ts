// Rules for the senior Monday brief. Pure: no database, no model. Tests: src/test/senior-brief.test.ts.
//
// One email a week, about ONE already-drafted private message, chosen by the simple rules below. A model writes the
// draft (draft.ts); it never chooses what to draft.

export const BRIEF_MIN_GAP_DAYS = 6
export const PAUSE_DAYS = 90
export const DEFAULT_WEEKLY_CEILING = 200
export const RECRUITER_WINDOW = { minDays: 7, maxDays: 45 } as const
/** Someone we wrote to in this many days is not asked again by an intro request. */
export const INTRO_QUIET_DAYS = 30

const DAY = 86_400_000

export type ItemKind = 'recruiter_follow_up' | 'intro_request'

export type BriefContact = {
  id: string
  name: string
  email: string | null
  emails: string[]
  title: string | null
  company: string | null
  inferredCompany: string | null
  warmth: 'HOT' | 'WARM' | 'COLD'
  isPriority: boolean
  isRecruiter: boolean
  /** Candidate-confirmed that this person left `company`. */
  leftCompany: boolean
}

export type BriefOutreach = { contactId: string | null; loggedAt: Date }

export type BriefItem = {
  kind: ItemKind
  contact: BriefContact
  /** Address to write to; never empty. */
  toEmail: string
  companyName: string | null
  /** Days since the last logged outreach to this contact; null when none. */
  daysSinceContact: number | null
}

export function contactAddress(c: Pick<BriefContact, 'email' | 'emails'>): string | null {
  return c.email?.trim() || c.emails.find((e) => e.trim())?.trim() || null
}

/** Confidential mode: a recruiter follow-up talks about the search itself, so it is never drafted. */
export function kindsAllowed(confidentialSearchMode: boolean): ItemKind[] {
  return confidentialSearchMode ? ['intro_request'] : ['recruiter_follow_up', 'intro_request']
}

/** The hard cap: one draft per member per 6 days, whatever called us. */
export function draftAllowed(
  m: { lastDraftAt: Date | null; pausedUntil: Date | null; optedOut: boolean },
  now: Date,
): { ok: true } | { ok: false; reason: 'opted_out' | 'paused' | 'too_soon' } {
  if (m.optedOut) return { ok: false, reason: 'opted_out' }
  if (m.pausedUntil && m.pausedUntil.getTime() > now.getTime()) return { ok: false, reason: 'paused' }
  if (m.lastDraftAt && now.getTime() - m.lastDraftAt.getTime() < BRIEF_MIN_GAP_DAYS * DAY) return { ok: false, reason: 'too_soon' }
  return { ok: true }
}

export function weeklyCeiling(env: string | undefined): number {
  const n = Number(env)
  return Number.isFinite(n) && n >= 0 && env !== undefined && env.trim() !== '' ? Math.floor(n) : DEFAULT_WEEKLY_CEILING
}

export function ceilingReached(draftsThisWeek: number, ceiling: number): boolean {
  return draftsThisWeek >= ceiling
}

const WARMTH_RANK = { HOT: 0, WARM: 1, COLD: 2 } as const

/** (a) A recruiter logged 7 to 45 days ago with nothing logged to them since. Most recent such conversation wins. */
export function recruiterFollowUp(contacts: BriefContact[], outreach: BriefOutreach[], now: Date): BriefItem | null {
  const latestByContact = new Map<string, Date>()
  for (const o of outreach) {
    if (!o.contactId) continue
    const prev = latestByContact.get(o.contactId)
    if (!prev || o.loggedAt > prev) latestByContact.set(o.contactId, o.loggedAt)
  }
  const found = contacts
    .filter((c) => c.isRecruiter && contactAddress(c))
    .map((c) => ({ c, last: latestByContact.get(c.id) }))
    .filter((x): x is { c: BriefContact; last: Date } => {
      if (!x.last) return false
      const days = (now.getTime() - x.last.getTime()) / DAY
      return days >= RECRUITER_WINDOW.minDays && days <= RECRUITER_WINDOW.maxDays
    })
    .sort((a, b) => b.last.getTime() - a.last.getTime())[0]
  if (!found) return null
  return {
    kind: 'recruiter_follow_up',
    contact: found.c,
    toEmail: contactAddress(found.c)!,
    companyName: found.c.company ?? found.c.inferredCompany,
    daysSinceContact: Math.floor((now.getTime() - found.last.getTime()) / DAY),
  }
}

/** (b) The warmest contact who works at a company on the member's watchlist and has not been written to lately. */
export function introRequest(
  contacts: BriefContact[],
  outreach: BriefOutreach[],
  watchlist: string[],
  normalize: (name: string) => string,
  now: Date,
): BriefItem | null {
  const watched = new Set(watchlist.filter(Boolean))
  if (watched.size === 0) return null
  const latestByContact = new Map<string, Date>()
  for (const o of outreach) {
    if (!o.contactId) continue
    const prev = latestByContact.get(o.contactId)
    if (!prev || o.loggedAt > prev) latestByContact.set(o.contactId, o.loggedAt)
  }
  const eligible = contacts.filter((c) => {
    if (c.isRecruiter || c.leftCompany || !contactAddress(c)) return false
    const company = c.company ?? c.inferredCompany
    if (!company || !watched.has(normalize(company))) return false
    const last = latestByContact.get(c.id)
    return !last || (now.getTime() - last.getTime()) / DAY >= INTRO_QUIET_DAYS
  })
  eligible.sort(
    (a, b) =>
      WARMTH_RANK[a.warmth] - WARMTH_RANK[b.warmth] ||
      Number(b.isPriority) - Number(a.isPriority) ||
      a.name.localeCompare(b.name),
  )
  const c = eligible[0]
  if (!c) return null
  const last = latestByContact.get(c.id)
  return {
    kind: 'intro_request',
    contact: c,
    toEmail: contactAddress(c)!,
    companyName: c.company ?? c.inferredCompany,
    daysSinceContact: last ? Math.floor((now.getTime() - last.getTime()) / DAY) : null,
  }
}

/** The one item for the week, or null (then nothing is sent). (a) before (b); confidential mode allows (b) only. */
export function pickItem(
  input: {
    confidentialSearchMode: boolean
    contacts: BriefContact[]
    outreach: BriefOutreach[]
    watchlist: string[]
    normalize: (name: string) => string
  },
  now: Date,
): BriefItem | null {
  const allowed = kindsAllowed(input.confidentialSearchMode)
  if (allowed.includes('recruiter_follow_up')) {
    const a = recruiterFollowUp(input.contacts, input.outreach, now)
    if (a) return a
  }
  if (allowed.includes('intro_request')) return introRequest(input.contacts, input.outreach, input.watchlist, input.normalize, now)
  return null
}

/** Monday (UTC) of the week `d` falls in, as YYYY-MM-DD. Unique with the member: a second draft in a week is refused by the database. */
export function weekKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}

/** What each unsubscribe link type changes. Pure so the route and the tests share it. */
export function briefOptOutUpdate(type: string | null, now: Date): { seniorBriefOptedOut: true } | { seniorBriefPausedUntil: Date } | null {
  if (type === 'seniorBrief') return { seniorBriefOptedOut: true }
  if (type === 'seniorBriefPause') return { seniorBriefPausedUntil: new Date(now.getTime() + PAUSE_DAYS * DAY) }
  return null
}

/** Fixed, factual subjects: nothing the model wrote, nothing that names a search. */
export function draftSubject(kind: ItemKind, companyName: string | null): string {
  if (kind === 'recruiter_follow_up') return 'Following up'
  return companyName ? `Reconnecting about ${companyName}` : 'Reconnecting'
}
