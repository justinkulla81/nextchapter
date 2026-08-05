import type { SupportNetworkContact } from '@prisma/client'

// Rotates deterministically by day (same pattern as community-feed.ts's
// dayIndex) so the pick isn't static across a session but doesn't reshuffle
// on every render either. Pulled out of the component so the render
// function itself stays pure — Date.now() belongs in a plain helper, not
// inline in JSX.
export function pickDailyContact(contacts: SupportNetworkContact[]): SupportNetworkContact | null {
  if (contacts.length === 0) return null
  const pool = contacts.filter((c) => c.warmth === 'HOT')
  const source = pool.length > 0 ? pool : contacts
  const dayIndex = Math.floor(Date.now() / 86_400_000)
  return source[dayIndex % source.length]
}
