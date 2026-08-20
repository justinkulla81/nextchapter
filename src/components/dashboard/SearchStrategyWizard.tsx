'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UnlockAnnouncementDialog, type UnlockItem } from '@/components/dashboard/UnlockAnnouncementDialog'

export interface WizardStep {
  key: string
  label: string
  complete: boolean
  // Shown once, the moment this step transitions from incomplete to
  // complete — only the two steps that genuinely unlock another page
  // (Marketing Plan Willingness, Networking Willingness) set this.
  unlock?: { introText: string; items: UnlockItem[] }
}

// Field-level anchors that used to scroll straight to a specific card
// (search-strategy-checklist.ts, complete-profile/page.tsx,
// action-effort.ts's ANSWER_OPTIONAL_QUESTIONS/BENEFITS_PRIORITIES_CONFIRMED
// hrefs) — now resolved to which wizard step that anchor lives on, so those
// same links land on the right page instead of a hidden one.
const ANCHOR_TO_STEP_KEY: Record<string, string> = {
  'optional-questions': 'so-far',
  gapDuration: 'target-role',
  targetIndustries: 'target-role',
  primaryFunction: 'target-role',
  highestLevelReached: 'target-role',
  targetRoleType: 'target-role',
  remotePreference: 'target-role',
  'comp-benefits': 'benefits',
}

// A list of the 7 steps (same row shape as the Skills & Behavioral
// Assessments list — label, status, one action button) instead of a
// horizontal stepper — clicking a row opens that one step full-focus, with
// its own Back/Next/Exit controls; nothing else on the page competes for
// attention while a step is open. A hash deep-link (ANCHOR_TO_STEP_KEY)
// still opens straight into the target step, same as before.
export function SearchStrategyWizard({ steps, children }: { steps: WizardStep[]; children: ReactNode[] }) {
  const [openStep, setOpenStep] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const anchorKey = ANCHOR_TO_STEP_KEY[window.location.hash.slice(1)]
      const anchorStepIndex = anchorKey ? steps.findIndex((s) => s.key === anchorKey) : -1
      if (anchorStepIndex !== -1) return anchorStepIndex
    }
    return null
  })
  const prevCompleteRef = useRef(steps.map((s) => s.complete))
  const hashScrolledRef = useRef(false)
  const [unlockStep, setUnlockStep] = useState<WizardStep | null>(null)

  useEffect(() => {
    if (openStep === null) return
    const prev = prevCompleteRef.current
    const justCompleted = !prev[openStep] && steps[openStep]?.complete
    // Reacting to the profile data a server action just revalidated in, not
    // a render-time-derivable value.
    if (justCompleted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (steps[openStep]?.unlock) setUnlockStep(steps[openStep])
      if (openStep < steps.length - 1) setOpenStep((s) => (s === null ? s : s + 1))
    }
    prevCompleteRef.current = steps.map((s) => s.complete)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps])

  useEffect(() => {
    if (hashScrolledRef.current) return
    hashScrolledRef.current = true
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    if (!hash) return
    // Field-level anchors inside a step's own form (targetIndustries, etc.)
    // need a tick for that step's content to mount before the element exists.
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'center' }))
  }, [])

  if (openStep === null) {
    return (
      <>
        <div className="divide-y divide-border rounded-lg border border-border">
          {steps.map((step, i) => (
            <button
              key={step.key}
              type="button"
              onClick={() => setOpenStep(i)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                <p className={cn('text-xs', step.complete ? 'font-medium text-success' : 'text-muted-foreground')}>
                  {step.complete ? 'Complete' : 'Not completed yet'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* Decorative — the whole row is the click target (this
                    button element wraps everything), so this is a label
                    styled like a button, not a second nested control. */}
                <span
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium',
                    step.complete ? 'border border-input text-foreground' : 'bg-primary text-primary-foreground'
                  )}
                >
                  {step.complete ? 'Edit' : 'Answer'}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </div>
            </button>
          ))}
        </div>

        {unlockStep?.unlock && (
          <UnlockAnnouncementDialog
            open={!!unlockStep}
            onOpenChange={(open) => {
              if (!open) setUnlockStep(null)
            }}
            introText={unlockStep.unlock.introText}
            items={unlockStep.unlock.items}
            analyticsKey={`search_strategy_${unlockStep.key}`}
          />
        )}
      </>
    )
  }

  const step = steps[openStep]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpenStep(null)}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← Back to list
        </button>
        <span className="text-xs text-muted-foreground">
          {openStep + 1} of {steps.length} — {step.label}
        </span>
      </div>

      {children[openStep]}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setOpenStep((s) => (s === null ? s : Math.max(0, s - 1)))}
          disabled={openStep === 0}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => setOpenStep(null)}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4"
        >
          Exit to list
        </button>
        {openStep < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setOpenStep((s) => (s === null ? s : Math.min(steps.length - 1, s + 1)))}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpenStep(null)}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Done →
          </button>
        )}
      </div>

      {unlockStep?.unlock && (
        <UnlockAnnouncementDialog
          open={!!unlockStep}
          onOpenChange={(open) => {
            if (!open) setUnlockStep(null)
          }}
          introText={unlockStep.unlock.introText}
          items={unlockStep.unlock.items}
          analyticsKey={`search_strategy_${unlockStep.key}`}
        />
      )}
    </div>
  )
}
