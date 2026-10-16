import type { ReactNode } from 'react'
import { AssessmentCtaLink } from '@/components/dashboard/learning/AssessmentCtaLink'

// Shows a section's real layout dimmed and non-interactive so members can see
// what the assessment unlocks. `inert` removes the content from tab order and
// the accessibility tree; the visible note is the one interactive element.
export function LockedPreview({ locked, children }: { locked: boolean; children: ReactNode }) {
  if (!locked) return <>{children}</>
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>Locked until you take the skills assessment.</span>
        <AssessmentCtaLink source="learn_locked_preview" variant="inline" />
      </div>
      <div inert aria-hidden="true" className="pointer-events-none select-none opacity-50 blur-[2px]">
        {children}
      </div>
    </div>
  )
}
