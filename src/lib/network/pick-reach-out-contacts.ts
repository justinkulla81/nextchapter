import type { SupportNetworkContact } from '@prisma/client'

export interface ReachOutPoolContact extends SupportNetworkContact {
  hasReachedOut: boolean
}

const MAX_CARDS = 8

// The rotating "reach out" cards surface real candidates for outreach:
// people already starred as a priority, or people the candidate has already
// emailed before (continuing a thread is a warm ask, not a cold one).
// Replaces the old "warmth" HOT/WARM/COLD tag, which was never actually
// editable from the UI (see the Contact Directory rework) and didn't
// reflect any real action the candidate had taken — starring and emailing
// both do. Falls back to the full contact list only when neither signal
// exists yet, so the card still has someone to show a brand-new candidate.
export function pickReachOutContacts(contacts: ReachOutPoolContact[]): ReachOutPoolContact[] {
  const pool = contacts.filter((c) => c.isPriority || c.hasReachedOut)
  const source = pool.length > 0 ? pool : contacts
  const sorted = [...source].sort((a, b) => {
    if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1
    const aDate = (a.connectedAt ?? a.createdAt).getTime()
    const bDate = (b.connectedAt ?? b.createdAt).getTime()
    return bDate - aDate
  })
  return sorted.slice(0, MAX_CARDS)
}
