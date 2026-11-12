/**
 * Marks a visit as likely human once the browser reports real input. Automated visitors that run ordinary Chrome (a mail-security
 * scanner or crawler on 10-11 Nov 2026: ~1,780 one-page visitors, 38% of all visitors, none flagged by automation.ts) open a page and
 * never touch it, so "has interacted" separates them from people where the user-agent check cannot.
 *
 * Fires `onFirst` once, on the first trusted pointer, key, touch or wheel event (`isTrusted` is false for script-dispatched events).
 * A page view is sent before any input, so reports filter people, not events: the `visitor_interacted` event, and the
 * `human_interaction` property that later events carry. See `Likely human` cohort in PostHog.
 */
export type InteractionKind = 'pointer' | 'key' | 'touch' | 'wheel'

export interface InteractionTarget {
  addEventListener(type: string, listener: (event: { isTrusted: boolean }) => void, options?: { passive?: boolean; capture?: boolean }): void
  removeEventListener(type: string, listener: (event: { isTrusted: boolean }) => void, options?: { capture?: boolean }): void
}

const EVENTS: ReadonlyArray<[type: string, kind: InteractionKind]> = [
  ['pointerdown', 'pointer'],
  ['keydown', 'key'],
  ['touchstart', 'touch'],
  ['wheel', 'wheel'],
]

/** Returns a function that stops listening. `onFirst` runs at most once. */
export function watchForHumanInteraction(target: InteractionTarget, onFirst: (kind: InteractionKind) => void): () => void {
  const listeners: Array<[string, (event: { isTrusted: boolean }) => void]> = []
  let done = false
  const stop = () => {
    for (const [type, listener] of listeners) target.removeEventListener(type, listener, { capture: true })
    listeners.length = 0
  }
  for (const [type, kind] of EVENTS) {
    const listener = (event: { isTrusted: boolean }) => {
      if (done || !event.isTrusted) return
      done = true
      stop()
      onFirst(kind)
    }
    listeners.push([type, listener])
    target.addEventListener(type, listener, { passive: true, capture: true })
  }
  return stop
}
