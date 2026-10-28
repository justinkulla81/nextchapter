'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { InlineLoadingState, Spinner } from '@/components/ui/spinner'

const POLL_MS = 2000

// Shown while a just-uploaded résumé is being read in the background. It asks the server every couple of seconds
// and reloads the page once the reading has ended; the page then shows the next step, or what went wrong.
// Leaving this page does not stop the reading: coming back shows this screen again or the finished result.
export function ResumeParseProgress({ fileName }: { fileName: string }) {
  const router = useRouter()

  useEffect(() => {
    let stopped = false
    async function tick() {
      try {
        const res = await fetch('/api/onboarding/resume-status', { cache: 'no-store' })
        const body = (await res.json()) as { status?: string }
        if (!stopped && body.status !== 'processing') {
          router.refresh()
          return
        }
      } catch {
        // A dropped request just waits for the next tick.
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS)
    }
    let timer = setTimeout(tick, POLL_MS)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [router])

  return (
    <div className="cursor-progress space-y-4 rounded-lg border border-border p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Spinner size={32} />
        <p className="text-base font-medium text-ink">Reading your résumé…</p>
      </div>
      <p className="text-sm text-muted-foreground">
        We have <span className="font-medium text-foreground">{fileName}</span> and are filling in your answers from it. This usually takes under a minute.
        You can leave this page; we keep going and pick up where you left off.
      </p>
      <InlineLoadingState label="This page updates by itself." />
    </div>
  )
}
