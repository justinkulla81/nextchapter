'use client'

import { useEffect } from 'react'

// Renders nothing. On the résumé step it asks the server to load the job board into memory while the member picks a
// file, uploads it and waits for it to be read, so the job count on the next steps is not the first to pay for a cold
// load. Fire and forget: the page never depends on the answer.
export function WarmJobBoard() {
  useEffect(() => {
    fetch('/api/onboarding/warm', { method: 'POST', keepalive: true }).catch(() => {})
  }, [])
  return null
}
