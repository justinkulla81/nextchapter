'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

// Collapses the status-change buttons (I got an interview / They passed on
// me / etc.) behind a single "Next steps" toggle so a fresh application
// card isn't dominated by four buttons before there's anything to report —
// the buttons themselves are still plain Server Action forms, this just
// hides/shows them client-side.
export function NextStepsToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Next steps
      </Button>
    )
  }

  return <div className="flex flex-wrap gap-2">{children}</div>
}
