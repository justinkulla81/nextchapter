// The newsletter counts its issues as chapters. Chapter 1 is the Tuesday issue of 2026-11-03; each week after is the next chapter.
const CHAPTER_ONE = Date.UTC(2026, 10, 3)
const WEEK = 7 * 86_400_000

export function chapterNumber(now: Date = new Date()): number {
  return Math.max(1, Math.floor((now.getTime() - CHAPTER_ONE) / WEEK) + 1)
}

/** "Nov 5" style date for the masthead, in UTC so it matches the Tuesday send. */
export function chapterDate(now: Date = new Date()): string {
  return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
