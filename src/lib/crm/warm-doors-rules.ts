import { contactStrength, type ContactStrength } from '@/lib/crm/contact-strength'

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
  warmth: string
  connectedAt: Date | null
  linkedinDegree: string | null
  firstRepliedAt: Date | null
  lastTouchedAt: Date | null
  touchCount: number
  notes: string | null
}

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
  strength: ContactStrength
  note: string
}

/**
 * Only warm ways in count. A directory entry nobody has touched, or a route
 * that is weak, unverified or already declined, is not a door — the point is
 * that Justin can pick up the phone today and it helps.
 */
export function classifyDoors(people: DoorPerson[], routes: DoorRoute[], now: Date = new Date()): Door[] {
  const doors: Door[] = []
  for (const p of people) {
    const strength = contactStrength({ ...p, linkedinDegree: p.linkedinDegree }, now)
    if (strength !== 'hot' && strength !== 'warm') continue
    doors.push({
      kind: 'contact', personId: p.id, name: p.fullName, title: p.title, strength,
      note: strength === 'hot' ? 'Close contact' : 'Warm contact',
    })
  }
  for (const r of routes) {
    if (r.status === 'DECLINED') continue
    if (r.strength !== 'STRONG' && r.strength !== 'MEDIUM') continue
    doors.push({
      kind: 'route', personId: r.connectorPersonId, name: r.connectorName ?? 'Someone in your network', title: null,
      strength: r.strength === 'STRONG' ? 'hot' : 'warm',
      note: r.status === 'INTRO_MADE' ? 'Intro already made' : r.status === 'ASKED' ? 'Intro asked for' : 'Route in',
    })
  }
  return doors.sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'hot' ? -1 : 1))
}
