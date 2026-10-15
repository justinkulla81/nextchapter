
// The pure half of warm-doors.ts: what counts as a strong candidate and what
// counts as a warm way in. No I/O, so every threshold is unit-tested
// (src/test/warm-doors.test.ts).

/** Calibrated seniority at Director equivalent or above (scoreToLevelRankLabel's Tier 4). */
export const STRONG_LEVEL_RANK = 55
/** One matched elite institution or prestige employer is worth 10 (pedigree-bonus.ts). */
export const STRONG_PEDIGREE_BONUS = 10

/** The "good background" half of strong. Returns why, or null when it is not met. */
export function isStrongBackground(p: { levelRankScore: number | null; pedigreeBonus: number }): string | null {
  if (p.levelRankScore !== null && p.levelRankScore >= STRONG_LEVEL_RANK) return 'Director-level or above'
  if (p.pedigreeBonus >= STRONG_PEDIGREE_BONUS) return 'Elite school or prestige employer'
  return null
}

export interface DoorPerson {
  id: string
  fullName: string
  title: string | null
  /** Most recent real inbound email or LinkedIn message from them, or null. */
  lastReplyAt: Date | null
}

/** A contact only counts as a way in if they have actually written back this recently. */
export const REPLY_WINDOW_DAYS = 365
/** A reply this recent is a close contact; older within the window is a warm one. */
export const CLOSE_REPLY_DAYS = 90

export interface DoorRoute {
  id: string
  strength: 'STRONG' | 'MEDIUM' | 'WEAK' | 'UNVERIFIED'
  status: 'IDENTIFIED' | 'ASKED' | 'INTRO_MADE' | 'DECLINED'
  connectorName: string | null
  connectorPersonId: string | null
}

export interface Door {
  kind: 'contact' | 'route'
  /** The CRM person to call: the contact themselves, or the connector on a route. */
  personId: string | null
  name: string
  title: string | null
  strength: 'hot' | 'warm'
  note: string
}

/**
 * Only real ways in count. A contact is a door only if they replied to us in
 * the last year — not because they were imported as WARM, are a LinkedIn
 * connection, or we once emailed them. A route is a door when it is strong or
 * medium AND someone has asked for the intro (or it has been made). Anything else is not a way to help today.
 */
export function classifyDoors(people: DoorPerson[], routes: DoorRoute[], now: Date = new Date()): Door[] {
  const doors: Door[] = []
  for (const p of people) {
    if (!p.lastReplyAt) continue
    const days = (now.getTime() - p.lastReplyAt.getTime()) / 86_400_000
    if (days < 0 || days > REPLY_WINDOW_DAYS) continue
    const close = days <= CLOSE_REPLY_DAYS
    doors.push({
      kind: 'contact', personId: p.id, name: p.fullName, title: p.title, strength: close ? 'hot' : 'warm',
      note: `Replied ${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'} ago`,
    })
  }
  for (const r of routes) {
    // A route nobody has asked about is a note, not a way in; a declined one is closed.
    if (r.status !== 'ASKED' && r.status !== 'INTRO_MADE') continue
    if (r.strength !== 'STRONG' && r.strength !== 'MEDIUM') continue
    doors.push({
      kind: 'route', personId: r.connectorPersonId, name: r.connectorName ?? 'Someone in your network', title: null,
      strength: r.strength === 'STRONG' ? 'hot' : 'warm',
      note: r.status === 'INTRO_MADE' ? 'Intro already made' : 'Intro asked for',
    })
  }
  return doors.sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'hot' ? -1 : 1))
}
