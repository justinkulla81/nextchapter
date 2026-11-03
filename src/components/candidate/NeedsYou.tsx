'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

/**
 * Home's "Needs you" strip (docs/candidate-redesign.md: three sections at most on the first view). Program cards, funding,
 * employer interest, portfolio requests, reconnect, cheers and the like each render themselves only when they apply, so
 * the strip counts what actually arrived and hides itself when nothing did. Collapsed by default; the count says how many.
 */
export function NeedsYou({ children }: { children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = list.current
    if (!el) return
    const recount = () => setCount(Array.from(el.children).filter((c) => c.childElementCount > 0 || (c.textContent ?? '').trim() !== '').length)
    recount()
    const obs = new MutationObserver(recount)
    obs.observe(el, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  return (
    <section aria-label="Needs you" className={count === 0 ? 'hidden' : 'rounded-2xl border border-border bg-muted/40'}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="needs-you-list"
        onClick={() => {
          posthog.capture('home_needs_you_toggled', { open: !open, count })
          setOpen(!open)
        }}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-5 py-3 text-left text-base font-semibold text-ink"
      >
        <span>{count === 1 ? '1 thing needs you' : `${count} things need you`}</span>
        <span className="text-sm font-medium text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      <div id="needs-you-list" ref={list} hidden={!open && count > 0 ? true : undefined} className={open ? 'space-y-4 border-t border-border p-4' : undefined}>
        {children}
      </div>
    </section>
  )
}
