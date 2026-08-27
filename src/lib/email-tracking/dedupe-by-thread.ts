// A recruiter follow-up, a scheduling back-and-forth, or a multi-message
// rejection thread all create one TrackedEmailActivity row per Gmail
// message — real, distinct pieces of information worth keeping in the
// database, but not worth showing as separate rows on a dashboard stat tile
// meant to represent "who contacted you" or "how many of X happened," where
// one long conversation should read as one contact/event, not five.
// Callers pass rows already ordered `detectedAt: 'desc'`, so keeping only
// the first occurrence per threadId keeps the most recent message from each
// real conversation. Rows with no threadId (synced before this field
// existed) are never collapsed — each stands alone.
export function dedupeByThread<T extends { threadId: string | null }>(items: T[]): T[] {
  const seenThreadIds = new Set<string>()
  return items.filter((item) => {
    if (!item.threadId) return true
    if (seenThreadIds.has(item.threadId)) return false
    seenThreadIds.add(item.threadId)
    return true
  })
}
