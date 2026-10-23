const DAY = 86_400_000

/**
 * A few states (Washington, South Carolina, Utah, Kentucky) hand us a "notice
 * date" that is after today: the layoff date keyed in the filing-date column,
 * or a day and month swapped. A filing cannot be dated in the future, so such a
 * notice is read as filed the day we first fetched it, and the date the state
 * gave stays as the layoff date when the state gave no other. The stored row is
 * left alone: the date is part of how a re-fetch recognises the same filing.
 */
export function correctFutureDates<T extends { noticeDate: Date | null; effectiveDate: Date | null; fetchedAt: Date }>(n: T, now: Date = new Date()): T {
  if (!n.noticeDate || n.noticeDate.getTime() <= now.getTime() + DAY) return n
  return {
    ...n,
    noticeDate: n.fetchedAt.getTime() <= now.getTime() ? n.fetchedAt : now,
    effectiveDate: n.effectiveDate ?? n.noticeDate,
  }
}
