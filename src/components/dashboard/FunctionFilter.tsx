'use client'

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { JOB_FUNCTION_OPTIONS, parseFunctionParam, CRAWLER_FUNCTION_LABEL } from '@/lib/jobs/job-functions'

/**
 * The job's function (Engineering, Finance, Clinical, …): 21 choices, so a
 * searchable list rather than buttons (design principles). The `fn` URL parameter
 * holds the choice, so a reload or shared link keeps it.
 */
export function FunctionFilter({ surface }: { surface: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const current = parseFunctionParam(searchParams.get('fn'))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = [{ key: '', label: 'All functions' }, ...JOB_FUNCTION_OPTIONS]
    return q ? all.filter((o) => o.key && o.label.toLowerCase().includes(q)) : all
  }, [query])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function choose(key: string) {
    setOpen(false)
    setQuery('')
    if ((key || null) === current) return
    posthog.capture('job_function_filter_changed', { surface, function: key || 'ALL' })
    startTransition(() => router.replace(boardHref(searchParams, { fn: key || null }, { pathname }), { scroll: false }))
  }

  return (
    <div ref={boxRef} className={cn('relative flex items-center gap-2 text-sm text-muted-foreground', pending && 'cursor-wait')}>
      <span id={`${listId}-label`}>Function</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        aria-busy={pending}
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className={cn('rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground', pending && 'cursor-wait')}
      >
        {current ? CRAWLER_FUNCTION_LABEL[current] : 'All functions'}
        <span aria-hidden className="ml-1 text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-md border border-border bg-background p-2 shadow-md">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, options.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && options[active]) {
                e.preventDefault()
                choose(options[active].key)
              } else if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="Search functions"
            aria-label="Search functions"
            aria-controls={listId}
            aria-activedescendant={options[active] ? `${listId}-${options[active].key || 'all'}` : undefined}
            className="mb-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
          <ul id={listId} role="listbox" aria-label="Functions" className="max-h-64 overflow-y-auto">
            {options.length === 0 && <li className="px-2 py-1 text-sm text-muted-foreground">No function matches “{query}”</li>}
            {options.map((o, i) => (
              <li
                key={o.key || 'all'}
                id={`${listId}-${o.key || 'all'}`}
                role="option"
                aria-selected={(o.key || null) === current}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(o.key)
                }}
                className={cn(
                  'cursor-pointer rounded px-2 py-1 text-sm text-foreground',
                  i === active && 'bg-muted',
                  (o.key || null) === current && 'font-medium'
                )}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
