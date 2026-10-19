'use client'

import { Component, createContext, useContext, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { boardHref } from '@/lib/jobs/board-url'
import { selectedJobId, visibleCount, LIST_PAGE_SIZE, type JobListItem } from '@/lib/jobs/find-list'
import { SecondaryButtonStyle } from '@/components/dashboard/find/styles'
import { FindJobRow } from '@/components/dashboard/find/FindJobRow'
import { cn } from '@/lib/utils'

// Find a job, two panes (mockup: src/app/dev-preview/_mockups/jobs-find.tsx). A list on the left, the open
// job on the right. On a phone they are two screens: the list, then the job with a Back link. The open job
// is the `job` URL parameter, changed with history.pushState so choosing a job never reloads the page or
// runs the server again: the server already sent every job's detail with the page, and this only picks one.

interface PaneState {
  /** Jobs the member passed on in this session: the row dims, the detail offers Undo. */
  passed: ReadonlySet<string>
  setPassed: (id: string, passed: boolean) => void
}
const PaneContext = createContext<PaneState>({ passed: new Set(), setPassed: () => undefined })
export function useFindPane() {
  return useContext(PaneContext)
}

class DetailBoundary extends Component<{ children: ReactNode; fallback: ReactNode; jobId: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Job detail failed to render:', error, info.componentStack)
    posthog.capture('job_detail_failed', { jobId: this.props.jobId })
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function FindTwoPane({
  items,
  details,
  summary,
  part = 'jobs',
}: {
  items: JobListItem[]
  /** The open-job pane for each listed job, built on the server (it holds the member's match and the actions). */
  details: Record<string, ReactNode>
  /** "111 jobs that fit you" — what the list is. */
  summary: string
  part?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const param = searchParams.get('job')
  const openOnPhone = selectedJobId(items, param, false)
  const shownId = selectedJobId(items, param, true)
  const [pages, setPages] = useState(1)
  const [passed, setPassedSet] = useState<ReadonlySet<string>>(new Set())
  const detailRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const focusDetail = useRef(false)

  const ctx = useMemo<PaneState>(
    () => ({
      passed,
      setPassed: (id, isPassed) =>
        setPassedSet((prev) => {
          const next = new Set(prev)
          if (isPassed) next.add(id)
          else next.delete(id)
          return next
        }),
    }),
    [passed]
  )

  // After a choice, bring the job into view and let a keyboard or screen-reader user land on it.
  useEffect(() => {
    if (!focusDetail.current) return
    focusDetail.current = false
    const el = detailRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    if (el.getBoundingClientRect().top < 0 || openOnPhone) el.scrollIntoView({ block: 'start' })
  }, [param, openOnPhone])

  function go(href: string) {
    window.history.pushState(null, '', href)
  }

  function choose(item: JobListItem, position: number) {
    focusDetail.current = true
    go(boardHref(searchParams, { job: item.id }, { pathname }))
    posthog.capture('job_selected', { jobId: item.id, source: 'list', part, position: position + 1, verdict: item.verdict, kind: item.kind })
  }

  function backToList() {
    const id = openOnPhone
    go(boardHref(searchParams, { job: null }, { pathname }))
    posthog.capture('job_list_returned', { jobId: id, part })
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: 'start' }))
  }

  const shown = visibleCount(items, pages, shownId)
  const rows = items.slice(0, shown)
  const item = items.find((i) => i.id === shownId) ?? null

  return (
    <PaneContext.Provider value={ctx}>
      <div className="grid items-start gap-6 lg:grid-cols-[26rem_1fr]">
        <div ref={listRef} className={cn('scroll-mt-4 space-y-3', openOnPhone && 'hidden lg:block')}>
          <p className="text-sm font-medium text-ink" aria-live="polite">
            {summary}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white" aria-label="Jobs">
            {rows.map((it, i) => (
              <FindJobRow key={it.id} item={it} selected={it.id === shownId} passed={passed.has(it.id)} onChoose={() => choose(it, i)} href={boardHref(searchParams, { job: it.id }, { pathname })} />
            ))}
          </ul>
          {shown < items.length && (
            <button
              type="button"
              className={SecondaryButtonStyle}
              onClick={() => {
                setPages((p) => p + 1)
                posthog.capture('find_more_jobs_shown', { shown: Math.min(items.length, shown + LIST_PAGE_SIZE), total: items.length, part })
              }}
            >
              Show {Math.min(LIST_PAGE_SIZE, items.length - shown)} more
            </button>
          )}
        </div>

        <div
          ref={detailRef}
          tabIndex={-1}
          aria-label={item ? `${item.title} at ${item.company}` : 'Job'}
          className={cn('min-w-0 scroll-mt-4 outline-none lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:rounded-2xl', !openOnPhone && 'hidden lg:block')}
        >
          <button type="button" onClick={backToList} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand underline underline-offset-4 lg:hidden">
            <ChevronLeft className="size-4" aria-hidden />
            Back to jobs
          </button>
          {item ? (
            <DetailBoundary
              key={item.id}
              jobId={item.id}
              fallback={
                <div role="alert" className="space-y-2 rounded-2xl border border-border bg-white p-7">
                  <p className="text-base font-semibold text-ink">We could not show this job here.</p>
                  <p className="text-sm text-muted-foreground">Nothing was lost. Open its own page, or pick another job from the list.</p>
                  <Link href={item.href} className="text-sm font-medium text-brand underline underline-offset-4">
                    Open {item.title}
                  </Link>
                </div>
              }
            >
              {details[item.id] ?? <p className="rounded-2xl border border-border bg-white p-7 text-sm text-muted-foreground">Pick a job from the list to see why it fits you.</p>}
            </DetailBoundary>
          ) : null}
        </div>
      </div>
    </PaneContext.Provider>
  )
}
