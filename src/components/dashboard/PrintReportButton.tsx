'use client'

import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'

export function PrintReportButton({ event, properties }: { event?: string; properties?: Record<string, unknown> } = {}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        if (event) posthog.capture(event, properties)
        window.print()
      }}
    >
      Print / Save as PDF
    </Button>
  )
}
