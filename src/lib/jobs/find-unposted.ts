// "Not posted yet" in the redesign (docs/candidate-redesign.md): each likely opening says what happened (a fact from a
// public filing or a news report), who the member knows there, and ONE next step. One opening carries the primary
// action; the rest are quiet. Pure and client-safe; the data comes from getLikelyOpeningsForCandidate and the member's
// own contacts and is only reshaped here. Tests: src/test/find-unposted.test.ts.

import { companyKey, sourceLinkLabel, type SignalSource } from '@/lib/likely-openings/roles'

export type UnpostedSignalType = 'EXEC_DEPARTURE' | 'EXEC_APPOINTMENT' | 'FUNDING_RAISE'

/** What the list needs from a likely opening (a subset of LikelyOpeningForCandidate). */
export interface OpeningInput {
  id: string
  companyName: string
  signalType: UnpostedSignalType
  summary: string
  filingDate: Date
  filingUrl: string
  source: SignalSource
  /** Why it was surfaced for this member, in plain words ("Fits your finance background"). */
  reason: string | null
  companyRelation: 'watched' | 'applied' | null
}

/** One of the member's own contacts at a company. */
export interface KnownPerson {
  id: string
  name: string
  title: string | null
}

export const SIGNAL_LABEL: Record<UnpostedSignalType, string> = {
  EXEC_DEPARTURE: 'Leadership change',
  EXEC_APPOINTMENT: 'Leadership change',
  FUNDING_RAISE: 'New funding',
}

export interface UnpostedItem {
  id: string
  companyName: string
  signalType: UnpostedSignalType
  signalLabel: string
  /** What happened, in one sentence. */
  summary: string
  /** Why this one is shown to this member. */
  why: string | null
  /** The fact it rests on: "From a public SEC filing on Oct 12." */
  sourceLine: string
  filingUrl: string
  filingLinkLabel: string
  /** "Priya Shah (VP Operations) works there." / "No one you know there yet." */
  know: string
  action: { kind: 'contact' | 'search'; label: string; href: string; contactId: string | null }
  /** Exactly one item on the page is primary. */
  primary: boolean
}

/** Contacts grouped by the company key shared with the SEC filer names (companyKey), so "Acme Inc." meets "Acme". */
export function groupContactsByCompany(contacts: { id: string; name: string; title: string | null; company: string | null; inferredCompany: string | null }[]): Map<string, KnownPerson[]> {
  const out = new Map<string, KnownPerson[]>()
  for (const c of contacts) {
    const seen = new Set<string>()
    for (const raw of [c.company, c.inferredCompany]) {
      if (!raw) continue
      const key = companyKey(raw)
      if (!key || seen.has(key)) continue
      seen.add(key)
      const list = out.get(key)
      const person = { id: c.id, name: c.name, title: c.title }
      if (list) list.push(person)
      else out.set(key, [person])
    }
  }
  return out
}

export function linkedinPeopleSearchUrl(companyName: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${companyName} recruiter`)}`
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function sourceLine(source: SignalSource, filingDate: Date): string {
  return `${source === 'news' ? 'From a news report' : 'From a public SEC filing'} on ${shortDate(filingDate)}.`
}

const personLabel = (p: KnownPerson) => (p.title ? `${p.name} (${p.title})` : p.name)

/** "Priya Shah (VP Operations) works there." / "A and B work there." / "A, B and 2 more work there." */
export function knowLine(people: KnownPerson[]): string {
  if (people.length === 0) return 'No one you know there yet.'
  if (people.length === 1) return `${personLabel(people[0])} works there.`
  if (people.length === 2) return `${personLabel(people[0])} and ${personLabel(people[1])} work there.`
  return `${personLabel(people[0])}, ${personLabel(people[1])} and ${people.length - 2} more work there.`
}

/**
 * The list, in the order given (already ranked by fit). The primary action goes to the first opening where the member
 * knows someone, since a message to a person is the warmest next step; with no contacts anywhere, to the first one.
 */
export function buildUnpostedItems(openings: OpeningInput[], contacts: Map<string, KnownPerson[]>): UnpostedItem[] {
  const withPeople = openings.map((o) => ({ o, people: contacts.get(companyKey(o.companyName)) ?? [] }))
  const primaryId = (withPeople.find((x) => x.people.length > 0) ?? withPeople[0])?.o.id
  return withPeople.map(({ o, people }) => {
    const first = people[0]
    return {
      id: o.id,
      companyName: o.companyName,
      signalType: o.signalType,
      signalLabel: SIGNAL_LABEL[o.signalType],
      summary: o.summary,
      why: o.reason,
      sourceLine: sourceLine(o.source, o.filingDate),
      filingUrl: o.filingUrl,
      filingLinkLabel: sourceLinkLabel(o.source),
      know: knowLine(people),
      action: first
        ? { kind: 'contact' as const, label: `Reach out to ${first.name}`, href: `/dashboard/network/contacts/${first.id}`, contactId: first.id }
        : { kind: 'search' as const, label: 'Find someone there', href: linkedinPeopleSearchUrl(o.companyName), contactId: null },
      primary: o.id === primaryId,
    }
  })
}

/** How many openings show on the first view; the rest sit behind "Show more". */
export const UNPOSTED_FIRST_VIEW = 4

export function splitFirstView<T>(items: T[]): { shown: T[]; more: T[] } {
  return { shown: items.slice(0, UNPOSTED_FIRST_VIEW), more: items.slice(UNPOSTED_FIRST_VIEW) }
}
