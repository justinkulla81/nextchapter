// What counts as a page that is too slow. One place, so the browser watcher, the server timers and the alert agree.
//
// SLOW: past Google's "poor" Largest Contentful Paint line (4 s). The member is waiting and some will give up.
// STALLED: 10 s. Nobody waits that long on purpose; this is a failure, not a slow page.
// Server reads (lib/perf/timed.ts) use their own, tighter numbers: 300 ms is recorded, 3 s is a stall.

export const SLOW_PAGE_MS = 4_000
export const STALLED_PAGE_MS = 10_000

/** The alert fires when, inside WINDOW_MINUTES, at least MIN_EVENTS slow or stalled reports come from at least MIN_PEOPLE people, or any page's own data timed out MIN_TIMEOUTS times. */
export const ALERT_WINDOW_MINUTES = 15
export const ALERT_MIN_EVENTS = 5
export const ALERT_MIN_PEOPLE = 2
export const ALERT_MIN_TIMEOUTS = 3
/** One alert email at most this often, however long the trouble lasts. */
export const ALERT_COOLDOWN_MS = 60 * 60 * 1000
