/**
 * When the stream posts and what it posts next. Pure, so the rules are tested without a clock or a database.
 *
 * The stream wakes every five minutes and posts at most one thing per tick, never closer than GAP_MINUTES to the last post, and only
 * inside the posting window. A layoff post is always followed by a non-layoff post (a "story"), so layoffs never arrive in a burst
 * however many are waiting. With no layoffs waiting it still posts BASELINE_STORIES_PER_DAY stories, spread across the window.
 */

/** The window is 12:00 to 02:00 UTC, 8am to 10pm Eastern in winter and 7am to 9pm in summer. */
export const WINDOW_START_HOUR = 12
export const WINDOW_HOURS = 14
export const GAP_MINUTES = 20
export const BASELINE_STORIES_PER_DAY = 3
/** X is billed per post, so it posts less often, with one story a day. */
const GAP_BY_CHANNEL: Record<string, number> = { x: 30 }
const STORIES_BY_CHANNEL: Record<string, number> = { x: 1 }

export const gapMinutes = (channel: string): number => GAP_BY_CHANNEL[channel] ?? GAP_MINUTES
export const baselineStories = (channel: string): number => STORIES_BY_CHANNEL[channel] ?? BASELINE_STORIES_PER_DAY

/**
 * Channels take turns on the five-minute ticks (even and odd slots), so two channels never post in the same minute. `index` is the
 * channel's place in the channel list.
 */
export const tickSlot = (now: Date, index: number): boolean => Math.floor(now.getUTCMinutes() / 5) % 2 === index % 2

export type Kind = 'layoff' | 'story'

export function inWindow(now: Date): boolean {
  const h = now.getUTCHours()
  return h >= WINDOW_START_HOUR || h < (WINDOW_START_HOUR + WINDOW_HOURS) % 24
}

/** The stream's day starts with its window, so 01:00 UTC still belongs to the day that began at 12:00 UTC the day before. */
export function streamDay(now: Date): string {
  return new Date(now.getTime() - WINDOW_START_HOUR * 3_600_000).toISOString().slice(0, 10)
}

/** How far through the window it is, 0 at the start and 1 at the end. */
function windowFraction(now: Date): number {
  const hours = (now.getTime() - (Date.parse(`${streamDay(now)}T00:00:00Z`) + WINDOW_START_HOUR * 3_600_000)) / 3_600_000
  return Math.min(1, Math.max(0, hours / WINDOW_HOURS))
}

/** A baseline story is due when fewer have gone out today than the share of the window that has passed calls for. */
export function storyDue(now: Date, storiesToday: number, perDay = BASELINE_STORIES_PER_DAY): boolean {
  return storiesToday < Math.ceil(windowFraction(now) * perDay)
}

export function gapPassed(now: Date, lastAt: string | null, gap = GAP_MINUTES): boolean {
  return !lastAt || now.getTime() - Date.parse(lastAt) >= gap * 60_000
}

/**
 * What to try first this tick. After a layoff comes a story; otherwise a waiting layoff goes next, and a baseline story only when one
 * is due. `null` means wait. The caller falls back to the other kind when the first has nothing to post.
 */
export function nextKind(s: { lastKind: Kind | null; layoffWaiting: boolean; storyIsDue: boolean }): Kind | null {
  if (s.lastKind === 'layoff') return 'story'
  if (s.layoffWaiting) return 'layoff'
  return s.storyIsDue ? 'story' : null
}
