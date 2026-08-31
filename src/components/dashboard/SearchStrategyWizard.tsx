'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { UnlockAnnouncementDialog, type UnlockItem } from '@/components/dashboard/UnlockAnnouncementDialog'

// One underlying, independently-completable question set (its own save
// action, its own "just unlocked" moment) that now lives on a shared page
// alongside one or more siblings — see WizardPage below. Keeping these
// tracked individually (rather than collapsing to one complete/unlock per
// page) means e.g. Marketing Plan Willingness still unlocks My Marketing
// Plan/LinkedIn the moment IT'S answered, even if the Networking question
// sharing its page isn't answered yet.
export interface WizardStepItem {
  key: string
  complete: boolean
  unlock?: { introText: string; items: UnlockItem[] }
}

export interface WizardPage {
  key: string
  label: string
  items: WizardStepItem[]
}

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

function findPageIndexForItemKey(pages: WizardPage[], itemKey: string): number {
  return pages.findIndex((p) => p.items.some((i) => i.key === itemKey))
}

// The server always renders the list view (it has no access to localStorage
// or window.location.hash) — restoring position has to happen in an effect,
// never in useState's own initializer, or the client's first render
// mismatches what was already sent down as HTML and React discards the
// restored value. useLayoutEffect (not useEffect) so the switch happens
// before the browser paints the list, instead of flashing it first.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// A list of pages (label, status, one action button) instead of a
// horizontal stepper — clicking a row opens that one page full-focus, with
// its own Back/Next/Exit controls; nothing else on the page competes for
// attention while a page is open. A hash deep-link (ANCHOR_TO_STEP_KEY)
// still opens straight into the target page, and the last page visited is
// remembered per-candidate (localStorage) so leaving and coming back lands
// right where they left off instead of back at the list.
export function SearchStrategyWizard({
  pages,
  children,
  candidateId,
}: {
  pages: WizardPage[]
  children: ReactNode[]
  candidateId: string
}) {
  const storageKey = `search-strategy-open-page:${candidateId}`

  const [openPage, setOpenPageState] = useState<number | null>(null)
  const restoredRef = useRef(false)

  useIsomorphicLayoutEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (window.location.hash) {
      const anchorKey = ANCHOR_TO_STEP_KEY[window.location.hash.slice(1)]
      const anchorPageIndex = anchorKey ? findPageIndexForItemKey(pages, anchorKey) : -1
      if (anchorPageIndex !== -1) {
        setOpenPageState(anchorPageIndex)
        return
      }
    }
    try {
      const savedKey = window.localStorage.getItem(storageKey)
      const savedIndex = savedKey ? pages.findIndex((p) => p.key === savedKey) : -1
      if (savedIndex !== -1) setOpenPageState(savedIndex)
    } catch {
      // Private-browsing/localStorage-disabled — just fall back to the list.
    }
  }, [])

  const setOpenPage = (next: number | null) => {
    setOpenPageState(next)
    try {
      if (next === null) window.localStorage.removeItem(storageKey)
      else window.localStorage.setItem(storageKey, pages[next].key)
    } catch {
      // Nothing to do — remembering position is a nicety, not load-bearing.
    }
  }

  const flatItems = pages.flatMap((p) => p.items)
  const prevCompleteRef = useRef<Map<string, boolean>>(new Map(flatItems.map((i) => [i.key, i.complete])))
  const prevPageCompleteRef = useRef<Map<string, boolean>>(
    new Map(pages.map((p) => [p.key, p.items.every((i) => i.complete)]))
  )
  const hashScrolledRef = useRef(false)
  const [unlockItem, setUnlockItem] = useState<WizardStepItem | null>(null)

  useEffect(() => {
    const prevComplete = prevCompleteRef.current
    const newlyUnlocked = flatItems.find((item) => item.unlock && item.complete && prevComplete.get(item.key) === false)
    if (newlyUnlocked) {
      setUnlockItem(newlyUnlocked)
    }
    prevCompleteRef.current = new Map(flatItems.map((i) => [i.key, i.complete]))

    if (openPage !== null) {
      const page = pages[openPage]
      const pageNowComplete = page.items.every((i) => i.complete)
      const pageWasComplete = prevPageCompleteRef.current.get(page.key)
      if (pageNowComplete && pageWasComplete === false && openPage < pages.length - 1) {
        setOpenPage(openPage + 1)
      }
    }
    prevPageCompleteRef.current = new Map(pages.map((p) => [p.key, p.items.every((i) => i.complete)]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages])

  useEffect(() => {
    if (hashScrolledRef.current) return
    hashScrolledRef.current = true
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    if (!hash) return
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'center' }))
  }, [])

  const unlockDialog = unlockItem?.unlock && (
    <UnlockAnnouncementDialog
      open={!!unlockItem}
      onOpenChange={(open) => {
        if (!open) setUnlockItem(null)
      }}
      introText={unlockItem.unlock.introText}
      items={unlockItem.unlock.items}
      analyticsKey={`search_strategy_${unlockItem.key}`}
    />
  )

  if (openPage === null) {
    const pageComplete = pages.map((p) => p.items.every((item) => item.complete))
    const firstIncomplete = pageComplete.findIndex((complete) => !complete)
    const allComplete = firstIncomplete === -1
    const noneStarted = pages.every((p) => p.items.every((item) => !item.complete))
    const continueTarget = allComplete ? 0 : firstIncomplete
    const buttonLabel = allComplete
      ? 'Review your Search Strategy'
      : noneStarted
        ? 'Start your Search Strategy'
        : 'Continue your Search Strategy'

    return (
      <>
        {/* One status row per part, purely informational — a button on each
            row (and a per-row Answer/Edit pill) read as N separate calls to
            action; the single button below is the only real one, and it
            already knows where to resume. */}
        <div className="divide-y divide-border rounded-lg border border-border">
          {pages.map((page, i) => (
            <div key={page.key} className="flex items-center justify-between gap-3 p-4">
              <p className="text-sm font-medium text-foreground">
                Part {i + 1}: {page.label}
              </p>
              <p
                className={cn(
                  'shrink-0 text-xs',
                  pageComplete[i] ? 'font-medium text-success' : 'text-muted-foreground'
                )}
              >
                {pageComplete[i] ? 'Complete' : 'Not completed yet'}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpenPage(continueTarget)}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {buttonLabel}
        </button>

        {unlockDialog}
      </>
    )
  }

  const page = pages[openPage]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpenPage(null)}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← Back to list
        </button>
        <span className="text-xs text-muted-foreground">
          {openPage + 1} of {pages.length} — {page.label}
        </span>
      </div>

      {children[openPage]}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setOpenPage(Math.max(0, openPage - 1))}
          disabled={openPage === 0}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => setOpenPage(null)}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4"
        >
          Exit to list
        </button>
        {openPage < pages.length - 1 ? (
          <button
            type="button"
            onClick={() => setOpenPage(Math.min(pages.length - 1, openPage + 1))}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpenPage(null)}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Done →
          </button>
        )}
      </div>

      {unlockDialog}
    </div>
  )
}
