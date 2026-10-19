'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A "More about your search" fold. It stays closed until someone needs something inside it: a link
 * that ends in #something inside the fold (for example #culture-preferences) opens it and scrolls there.
 */
export function MoreDetails({ summary, children }: { summary: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const openForHash = () => {
      const id = window.location.hash.slice(1)
      const target = id ? document.getElementById(id) : null
      if (target && ref.current?.contains(target)) {
        ref.current.open = true
        target.scrollIntoView({ block: 'start' })
      }
    }
    openForHash()
    window.addEventListener('hashchange', openForHash)
    return () => window.removeEventListener('hashchange', openForHash)
  }, [])
  return (
    <details ref={ref} className="group rounded-2xl border border-border bg-white px-5 py-3.5">
      <summary className="cursor-pointer list-none text-base font-semibold text-navy [&::-webkit-details-marker]:hidden">
        {summary}
        <span aria-hidden className="ml-2 text-muted-foreground group-open:hidden">+</span>
      </summary>
      <div className="mt-4 space-y-6">{children}</div>
    </details>
  )
}
