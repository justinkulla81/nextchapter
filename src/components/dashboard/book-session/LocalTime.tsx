'use client'

import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

// Shows an instant in the viewer's own time zone. The zone is only known in the browser, so the
// server render (and hydration) shows the text passed in, and the browser then shows local time;
// that keeps the two renders identical and avoids a hydration mismatch.
export function LocalTime({ iso, fallback }: { iso: string; fallback: string }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => new Date(iso).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZoneName: 'short' }),
    () => fallback
  )
  return <time dateTime={iso}>{text}</time>
}
