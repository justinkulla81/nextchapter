'use client'

import { useRef, useState, useEffect } from 'react'
import { useActionState } from 'react'
import { updateAssessment } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { QuadBlockCard } from './QuadBlockCard'
import { LikertItemRow } from './LikertItemRow'
import { ProfileBuildTracker } from './ProfileBuildTracker'

interface BlockData {
  id: string
  statements: { id: string; statementText: string; dimension: string }[]
}

interface LikertItemData {
  id: string
  itemText: string
  dimension: string
}

const PAGE_SIZE = 6
const LIKERT_PAGE_SIZE = 8

// Shown briefly after each "Next" — cycles through so it never repeats back
// to back. Purely cosmetic encouragement, distinct from the factual progress
// message the tracker falls back to otherwise.
const ENCOURAGEMENT = [
  "Good — that's useful signal.",
  "Got it. We're building your picture.",
  "Noted — that tells us a lot about how you work.",
  "Nice, that's a clear one.",
  "Helpful. Keep going.",
  "That's real signal — thank you.",
]

const THINKING_DELAY_MS = 550

export function AssessmentForm({
  blocks,
  likertItems,
}: {
  blocks: BlockData[]
  likertItems: LikertItemData[]
}) {
  const [state, formAction, pending] = useActionState(updateAssessment, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  const quadPages: BlockData[][] = []
  for (let i = 0; i < blocks.length; i += PAGE_SIZE) {
    quadPages.push(blocks.slice(i, i + PAGE_SIZE))
  }
  const likertPages: LikertItemData[][] = []
  for (let i = 0; i < likertItems.length; i += LIKERT_PAGE_SIZE) {
    likertPages.push(likertItems.slice(i, i + LIKERT_PAGE_SIZE))
  }

  // Each "page" is rendered always (never unmounted) — only visually
  // toggled — so QuadBlockCard/LikertItemRow's own internal selection
  // state survives moving forward/back through the wizard.
  const pageCount = quadPages.length + likertPages.length
  const [step, setStep] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [encouragementIndex, setEncouragementIndex] = useState<number | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Answered-state is lifted from QuadBlockCard/LikertItemRow (which own the
  // actual selection values locally) purely so this component can tell which
  // specific question — on which page — still needs an answer, for the
  // "jump to the first thing you missed" validation below.
  const [answeredBlocks, setAnsweredBlocks] = useState<Set<string>>(new Set())
  const [answeredLikertItems, setAnsweredLikertItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [step])

  // Counts actually-answered questions (not just completed pages) so the
  // "Building your profile" tracker moves the instant you tap an answer,
  // not only when you advance pages. Each page touches nearly all 9
  // dimensions at once (blocks/items rotate across dimensions), so a
  // per-dimension reveal would hit 9/9 after the very first page —
  // question-count progress is the honest signal.
  const totalItems = blocks.length + likertItems.length
  const completedItems = answeredBlocks.size + answeredLikertItems.size

  function goToStep(next: number) {
    setThinking(true)
    setHighlightId(null)
    window.setTimeout(() => {
      setStep(next)
      setThinking(false)
      setEncouragementIndex((i) => (i === null ? 0 : (i + 1) % ENCOURAGEMENT.length))
    }, THINKING_DELAY_MS)
  }

  // Finds the first unanswered block/item across every page, in order —
  // used both to block final submission and to jump straight to the gap.
  // Pass `onlyPageIndex` to restrict the scan to a single page (used to gate
  // "Next" so a candidate can't skip ahead with gaps on the current page).
  function findFirstUnanswered(onlyPageIndex?: number): { pageIndex: number; elementId: string } | null {
    for (let p = 0; p < quadPages.length; p++) {
      if (onlyPageIndex !== undefined && p !== onlyPageIndex) continue
      for (const block of quadPages[p]) {
        if (!answeredBlocks.has(block.id)) {
          return { pageIndex: p, elementId: `quad-block-${block.id}` }
        }
      }
    }
    for (let p = 0; p < likertPages.length; p++) {
      const globalIndex = quadPages.length + p
      if (onlyPageIndex !== undefined && globalIndex !== onlyPageIndex) continue
      for (const item of likertPages[p]) {
        if (!answeredLikertItems.has(item.id)) {
          return { pageIndex: globalIndex, elementId: `likert-item-${item.id}` }
        }
      }
    }
    return null
  }

  function handleNext() {
    const gap = findFirstUnanswered(step)
    if (gap) {
      setValidationError('Please answer every question on this page before continuing.')
      setHighlightId(gap.elementId)
      window.setTimeout(() => {
        document.getElementById(gap.elementId)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 50)
      return
    }
    setValidationError(null)
    goToStep(Math.min(pageCount - 1, step + 1))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const gap = findFirstUnanswered()
    if (!gap) {
      setValidationError(null)
      return
    }
    event.preventDefault()
    setValidationError("Looks like you missed one — we've jumped you to it below.")
    setHighlightId(gap.elementId)
    setStep(gap.pageIndex)
    window.setTimeout(() => {
      document.getElementById(gap.elementId)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 50)
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <ProfileBuildTracker
        completedItems={completedItems}
        totalItems={totalItems}
        isLastStep={step === pageCount - 1}
        encouragement={encouragementIndex !== null ? ENCOURAGEMENT[encouragementIndex] : null}
        thinking={thinking}
      />
      {quadPages.map((page, pageIndex) => (
        <div
          key={`quad-${pageIndex}`}
          className={cn('space-y-6', step !== pageIndex && 'hidden')}
        >
          <h2 className="text-xl font-semibold text-foreground">
            For each group of four, pick the statement least like you.
          </h2>
          {page.map((block) => (
            <QuadBlockCard
              key={block.id}
              blockId={block.id}
              statements={block.statements}
              onAnswered={(id) => setAnsweredBlocks((prev) => new Set(prev).add(id))}
              highlighted={highlightId === `quad-block-${block.id}`}
            />
          ))}
        </div>
      ))}

      {likertPages.map((page, pageIndex) => {
        const globalIndex = quadPages.length + pageIndex
        return (
          <div key={`likert-${pageIndex}`} className={cn('space-y-4', step !== globalIndex && 'hidden')}>
            <h2 className="text-xl font-semibold text-foreground">
              How much do you agree with each statement?
            </h2>
            {page.map((item) => (
              <LikertItemRow
                key={item.id}
                itemId={item.id}
                itemText={item.itemText}
                onAnswered={(id) => setAnsweredLikertItems((prev) => new Set(prev).add(id))}
                highlighted={highlightId === `likert-item-${item.id}`}
              />
            ))}
          </div>
        )
      })}

      {(validationError || state?.error) && (
        <p className="text-sm text-destructive">{validationError ?? state?.error}</p>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => goToStep(Math.max(0, step - 1))}
        >
          Back
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          Step {step + 1} of {pageCount}
        </span>
        {step < pageCount - 1 ? (
          <Button type="button" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Continue'}
          </Button>
        )}
      </div>
    </form>
  )
}
