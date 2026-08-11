'use client'

import { useRef, useState, useEffect } from 'react'
import { useActionState } from 'react'
import { submitPerformanceAssessment } from '@/app/dashboard/how-i-perform/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PerformanceItemRow } from './PerformanceItemRow'
import { PERFORMANCE_DIMENSION_LABEL, type PerformanceItem } from '@/lib/constants/how-i-perform-items'

const PAGE_SIZE = 8 // one dimension per page — 40 items / 8 per dimension = 5 pages

export function PerformanceAssessmentForm({ items }: { items: PerformanceItem[] }) {
  const [state, formAction, pending] = useActionState(submitPerformanceAssessment, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  const pages: PerformanceItem[][] = []
  for (let i = 0; i < items.length; i += PAGE_SIZE) {
    pages.push(items.slice(i, i + PAGE_SIZE))
  }

  const [step, setStep] = useState(0)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [answered, setAnswered] = useState<Set<number>>(new Set())

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [step])

  function findFirstUnanswered(onlyPageIndex?: number): { pageIndex: number; itemId: number } | null {
    for (let p = 0; p < pages.length; p++) {
      if (onlyPageIndex !== undefined && p !== onlyPageIndex) continue
      for (const item of pages[p]) {
        if (!answered.has(item.id)) return { pageIndex: p, itemId: item.id }
      }
    }
    return null
  }

  function handleNext() {
    const gap = findFirstUnanswered(step)
    if (gap) {
      setValidationError('Please answer every question on this page before continuing.')
      setHighlightId(gap.itemId)
      window.setTimeout(() => {
        document.getElementById(`performance-item-${gap.itemId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 50)
      return
    }
    setValidationError(null)
    setHighlightId(null)
    setStep((s) => Math.min(pages.length - 1, s + 1))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const gap = findFirstUnanswered()
    if (!gap) {
      setValidationError(null)
      return
    }
    event.preventDefault()
    setValidationError("Looks like you missed one — we've jumped you to it below.")
    setHighlightId(gap.itemId)
    setStep(gap.pageIndex)
    window.setTimeout(() => {
      document.getElementById(`performance-item-${gap.itemId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 50)
  }

  const totalItems = items.length
  const completedItems = answered.size

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(completedItems / totalItems) * 100}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {completedItems} of {totalItems} answered
        </p>
      </div>

      {pages.map((page, pageIndex) => (
        <div key={pageIndex} className={cn('space-y-4', step !== pageIndex && 'hidden')}>
          <h2 className="text-xl font-semibold text-foreground">
            {PERFORMANCE_DIMENSION_LABEL[page[0].dimension]}
          </h2>
          <p className="text-sm text-muted-foreground">How much do you agree with each statement?</p>
          {page.map((item) => (
            <PerformanceItemRow
              key={item.id}
              itemId={item.id}
              itemText={item.text}
              onAnswered={(id) => setAnswered((prev) => new Set(prev).add(id))}
              highlighted={highlightId === item.id}
            />
          ))}
        </div>
      ))}

      {(validationError || state?.error) && (
        <p className="text-sm text-destructive">{validationError ?? state?.error}</p>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          Step {step + 1} of {pages.length}
        </span>
        {step < pages.length - 1 ? (
          <Button type="button" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Finish'}
          </Button>
        )}
      </div>
    </form>
  )
}
