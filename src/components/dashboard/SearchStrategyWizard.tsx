'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface WizardStep {
  key: string
  label: string
  complete: boolean
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

// One page visible at a time, like the Market Reality Assessment wizard —
// numbered steps you can jump to directly, plus auto-advance the moment the
// current page's own save makes it complete (see search-strategy/actions.ts:
// every one of the 7 save actions either fails validation or leaves that
// page's isXComplete predicate true, so "just transitioned to complete" is a
// reliable "they just submitted this page" signal without any of the 7 form
// components needing their own onSaved callback).
export function SearchStrategyWizard({ steps, children }: { steps: WizardStep[]; children: ReactNode[] }) {
  const [currentStep, setCurrentStep] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const anchorKey = ANCHOR_TO_STEP_KEY[window.location.hash.slice(1)]
      const anchorStepIndex = anchorKey ? steps.findIndex((s) => s.key === anchorKey) : -1
      if (anchorStepIndex !== -1) return anchorStepIndex
    }
    const firstIncomplete = steps.findIndex((s) => !s.complete)
    return firstIncomplete === -1 ? steps.length - 1 : firstIncomplete
  })
  const prevCompleteRef = useRef(steps.map((s) => s.complete))
  const hashScrolledRef = useRef(false)

  useEffect(() => {
    const prev = prevCompleteRef.current
    if (!prev[currentStep] && steps[currentStep]?.complete && currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
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

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 sm:gap-1.5">
        {steps.map((step, i) => {
          const isActive = i === currentStep
          return (
            <li key={step.key} className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentStep(i)}
                className="flex items-center gap-1.5"
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : step.complete
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step.complete && !isActive ? '✓' : i + 1}
                </span>
                <span
                  className={cn(
                    'hidden text-sm sm:inline',
                    isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 && <div className="h-px w-3 shrink-0 bg-border sm:w-6" />}
            </li>
          )
        })}
      </ol>

      {children[currentStep]}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
        >
          ← Back
        </button>
        <span className="text-xs text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </span>
        {currentStep < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Skip for now →
          </button>
        ) : (
          <span className="w-20" aria-hidden />
        )}
      </div>
    </div>
  )
}
