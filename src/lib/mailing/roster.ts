/**
 * Roster math for one edition: base − excluded + added.
 *
 * Pure, so the composer, the send job and the tests all agree on who gets
 * an email. The base is every ACTIVE member of the target lists, once per
 * address however many of those lists they are on. Excluding someone is
 * this edition only; it never touches the list.
 */

export interface RosterMember {
  email: string
  personId: string | null
  listKey: string
  status: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED'
}

export interface RosterRow {
  email: string
  personId: string | null
  source: 'BASE' | 'ADDED_THIS_EDITION'
  excluded: boolean
  excludedReason: string | null
  fromListKeys: string[]
  alsoAddToListIds: string[]
  /** Anything but PENDING is history and is never rewritten. */
  status: string
}

export interface RosterInput {
  members: RosterMember[]
  existing: RosterRow[]
  suppressed: Set<string>
  /** personId → when they already got this report by hand. */
  manualSends: Map<string, Date>
}

export interface RosterCounts {
  base: number
  excluded: number
  added: number
  total: number
}

export function computeRoster({ members, existing, suppressed, manualSends }: RosterInput): RosterRow[] {
  const base = new Map<string, { personId: string | null; lists: Set<string> }>()
  for (const m of members) {
    if (m.status !== 'ACTIVE' || suppressed.has(m.email)) continue
    const row = base.get(m.email) ?? { personId: null, lists: new Set<string>() }
    row.personId ??= m.personId
    row.lists.add(m.listKey)
    base.set(m.email, row)
  }

  const byEmail = new Map(existing.map((r) => [r.email, r]))
  const out: RosterRow[] = []

  for (const [email, b] of base) {
    const prev = byEmail.get(email)
    const manual = b.personId ? manualSends.get(b.personId) : undefined
    out.push({
      email,
      personId: b.personId ?? prev?.personId ?? null,
      source: 'BASE',
      // A choice already made in the composer stands; a newcomer who already
      // got this report by hand starts unchecked, so nobody gets it twice.
      excluded: prev ? prev.excluded : !!manual,
      excludedReason: prev ? prev.excludedReason : manual ? 'already_sent_manually' : null,
      fromListKeys: [...b.lists].sort(),
      alsoAddToListIds: prev?.alsoAddToListIds ?? [],
      status: prev?.status ?? 'PENDING',
    })
  }

  for (const r of existing) {
    if (base.has(r.email)) continue
    // Someone who left the lists before sending drops off the roster; anyone
    // already sent to stays, since that row is the record of what happened.
    if (r.source === 'BASE' && r.status === 'PENDING') continue
    out.push({
      ...r,
      ...(suppressed.has(r.email) && r.status === 'PENDING'
        ? { excluded: true, excludedReason: 'suppressed' }
        : {}),
    })
  }
  return out
}

export function rosterCounts(rows: RosterRow[]): RosterCounts {
  const baseRows = rows.filter((r) => r.source === 'BASE')
  const excluded = rows.filter((r) => r.excluded).length
  const added = rows.filter((r) => r.source === 'ADDED_THIS_EDITION' && !r.excluded).length
  return { base: baseRows.length, excluded, added, total: rows.filter((r) => !r.excluded).length }
}
