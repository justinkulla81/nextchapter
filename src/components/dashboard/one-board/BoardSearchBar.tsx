'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, MapPin, X } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  BOARD_SORTS,
  BOARD_SORT_LABEL,
  EMPTY_BOARD_SEARCH,
  REMOTE_FILTERS,
  REMOTE_FILTER_LABEL,
  parseBoardSearchParams,
  withBoardSearchParams,
  type BoardSearchParams,
  type BoardSort,
  type RemoteFilter,
} from '@/lib/jobs/board-search'
import type { SearchSuggestion } from '@/lib/jobs/board-search-index'
import { suggestBoardSearch } from '@/app/dashboard/find-my-job/search-actions'

const TYPING_DEBOUNCE_MS = 600
const SUGGEST_DEBOUNCE_MS = 150

const fromUrl = (sp: URLSearchParams): BoardSearchParams =>
  parseBoardSearchParams({ q: sp.get('q') ?? undefined, loc: sp.get('loc') ?? undefined, remote: sp.get('remote') ?? undefined, sort: sp.get('sort') ?? undefined })

/**
 * The job board's search box: keywords (with company typeahead), a location (with
 * typeahead), remote / hybrid / on-site, and the sort. Everything lives in the URL
 * (q, loc, remote, sort — board-search.ts), so a search survives a reload and can be
 * shared; keywords apply after a short pause in typing, a location once picked; Enter or
 * "Search jobs" applies at once.
 */
export function BoardSearchBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const applied = fromUrl(searchParams)
  const [q, setQ] = useState(applied.q)
  const [loc, setLoc] = useState(applied.loc)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushed = useRef(`${applied.q}\u0000${applied.loc}`)

  // A link elsewhere on the page (an empty-state suggestion, Back) changed the URL: show it.
  const urlKey = `${applied.q}\u0000${applied.loc}`
  useEffect(() => {
    if (urlKey === lastPushed.current) return
    lastPushed.current = urlKey
    const [uq, uloc] = urlKey.split('\u0000')
    setQ(uq)
    setLoc(uloc)
  }, [urlKey])

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current)
  }, [])

  function apply(next: BoardSearchParams) {
    if (typingTimer.current) clearTimeout(typingTimer.current)
    const clean = parseBoardSearchParams(next)
    const params = withBoardSearchParams(searchParams, clean)
    if (params.toString() === searchParams.toString()) return
    lastPushed.current = `${clean.q}\u0000${clean.loc}`
    if (clean.loc !== loc) setLoc(clean.loc)
    // Results are tracked once they render (BoardSearchTracker), with their count.
    startTransition(() => router.replace(`${pathname}?${params.toString()}#apply-new-jobs`, { scroll: false }))
  }

  function applySoon(next: BoardSearchParams) {
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => apply(next), TYPING_DEBOUNCE_MS)
  }

  const current = { q, loc, remote: applied.remote, sort: applied.sort }
  const hasAnything = q !== '' || loc !== '' || applied.remote !== null || applied.sort !== 'best'

  function clear() {
    posthog.capture('job_search_cleared', { q: applied.q, loc: applied.loc, remote: applied.remote, sort: applied.sort })
    setQ('')
    setLoc('')
    apply(EMPTY_BOARD_SEARCH)
  }

  return (
    <form
      role="search"
      aria-label="Search the job board"
      aria-busy={pending}
      className={cn('space-y-3 rounded-lg border border-border bg-card p-4', pending && 'cursor-wait')}
      onSubmit={(e) => {
        e.preventDefault()
        apply(current)
      }}
    >
      <div className="flex flex-col gap-2 md:flex-row">
        <Typeahead
          kind="company"
          label="Job title, skill or company"
          placeholder='Try "VP finance", FP&A or company:Stripe'
          icon={<Search className="size-4" aria-hidden />}
          value={q}
          onChange={(v) => {
            setQ(v)
            applySoon({ ...current, q: v })
          }}
          onPick={(s) => {
            const v = `company:"${s.value}"`
            setQ(v)
            apply({ ...current, q: v })
          }}
          className="md:flex-[3]"
        />
        <Typeahead
          kind="location"
          label="Location"
          placeholder="City, state, metro or Remote"
          icon={<MapPin className="size-4" aria-hidden />}
          value={loc}
          // A half-typed place ("new y") would match nothing, so the location applies on a
          // pick, Enter or "Search jobs" rather than after a pause.
          onChange={(v) => setLoc(v)}
          onPick={(s) => {
            if (s.kind === 'remote') {
              setLoc('')
              apply({ ...current, loc: '', remote: 'remote' })
            } else {
              setLoc(s.value)
              apply({ ...current, loc: s.value })
            }
          }}
          className="md:flex-[2]"
        />
        <Button type="submit" disabled={pending} aria-busy={pending} className={cn('h-11 shrink-0', pending && 'cursor-wait')}>
          {pending ? (
            <>
              <Spinner size={14} /> Searching…
            </>
          ) : (
            'Search jobs'
          )}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <ButtonGroup
          label="Work arrangement"
          options={[{ key: 'any', label: 'Any' }, ...REMOTE_FILTERS.map((r) => ({ key: r, label: REMOTE_FILTER_LABEL[r] }))]}
          value={applied.remote ?? 'any'}
          pending={pending}
          onSelect={(k) => apply({ ...current, remote: k === 'any' ? null : (k as RemoteFilter) })}
        />
        <ButtonGroup
          label="Sort"
          options={BOARD_SORTS.map((s) => ({ key: s, label: BOARD_SORT_LABEL[s] }))}
          value={applied.sort}
          pending={pending}
          onSelect={(k) => apply({ ...current, sort: k as BoardSort })}
        />
        {hasAnything && (
          <button
            type="button"
            onClick={clear}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden /> Clear search
          </button>
        )}
      </div>
    </form>
  )
}

function ButtonGroup({
  label,
  options,
  value,
  pending,
  onSelect,
}: {
  label: string
  options: { key: string; label: string }[]
  value: string
  pending: boolean
  onSelect: (key: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground" id={`bsg-${label}`}>
        {label}
      </span>
      <div role="group" aria-labelledby={`bsg-${label}`} className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={value === o.key}
            onClick={() => value !== o.key && onSelect(o.key)}
            className={cn(
              'rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
              value === o.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground',
              pending && 'cursor-wait'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const KIND_NOTE: Record<SearchSuggestion['kind'], string> = {
  remote: 'Work arrangement',
  metro: 'Metro area',
  state: 'State',
  city: 'City',
  company: 'Company',
}

/** An input with a suggestion list (ARIA combobox): arrows move, Enter picks, Escape closes. */
function Typeahead({
  kind,
  label,
  placeholder,
  icon,
  value,
  onChange,
  onPick,
  className,
}: {
  kind: 'location' | 'company'
  label: string
  placeholder: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  onPick: (s: SearchSuggestion) => void
  className?: string
}) {
  const id = useId()
  const listId = `${id}-list`
  const [items, setItems] = useState<SearchSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  function fetchSuggestions(text: string) {
    if (timer.current) clearTimeout(timer.current)
    // company: already typed, or nothing to go on: no list.
    if (text.trim().length < 2 || (kind === 'company' && /company:|"/i.test(text))) {
      setItems([])
      setOpen(false)
      return
    }
    const mine = ++seq.current
    timer.current = setTimeout(() => {
      suggestBoardSearch(kind, text)
        .then((list) => {
          if (mine !== seq.current) return
          setItems(list)
          setActive(-1)
          setOpen(list.length > 0)
        })
        .catch(() => {
          // Typeahead is a convenience: typing and searching still work without it.
          if (mine === seq.current) setOpen(false)
        })
    }, SUGGEST_DEBOUNCE_MS)
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function pick(s: SearchSuggestion) {
    seq.current++
    setOpen(false)
    setItems([])
    onPick(s)
  }

  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">{icon}</span>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        maxLength={200}
        onChange={(e) => {
          onChange(e.target.value)
          fetchSuggestions(e.target.value)
        }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => (i + 1) % items.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault()
            pick(items[active])
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent pr-3 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand md:text-sm"
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md">
          {items.map((s, i) => (
            <li
              key={`${s.kind}-${s.value}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center justify-between gap-2 px-3 py-2', i === active && 'bg-muted')}
            >
              <span className="truncate text-foreground">{s.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {KIND_NOTE[s.kind]}
                {s.count ? ` · ${s.count.toLocaleString()} job${s.count === 1 ? '' : 's'}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
