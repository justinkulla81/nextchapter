// Resend's "opened" event carries no address or browser, only a time. Apple Mail Privacy Protection and mail-security scanners
// load the tracking pixel by themselves when the message arrives, so an open within moments of delivery is a machine's. The
// same two-minute window already marks a scanner's click (click-human.ts). We store the first open and a count, so the count
// of human opens is the stored count, less that first open when it came inside the window.
export const PREFETCH_OPEN_WINDOW_MS = 2 * 60 * 1000

export interface OpenFacts {
  sentAt: Date | null
  deliveredAt: Date | null
  openedAt: Date | null
  openCount: number
}

/** True when the first recorded open came so soon after delivery that a machine made it. */
export function firstOpenIsPrefetch(o: OpenFacts): boolean {
  const from = o.deliveredAt ?? o.sentAt
  return !!o.openedAt && !!from && o.openedAt.getTime() - from.getTime() <= PREFETCH_OPEN_WINDOW_MS
}

/** Opens that a person could have made: later opens always count, the first only when it was not a prefetch. */
export function humanOpenCount(o: OpenFacts): number {
  if (o.openCount <= 0 || !o.openedAt) return 0
  return firstOpenIsPrefetch(o) ? Math.max(0, o.openCount - 1) : o.openCount
}
