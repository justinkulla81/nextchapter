'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// The slide-over itself is ~20 KB of editing UI that is only needed once a
// row is clicked. This file is what the list pages import: the button, plus
// a tiny listener that loads the real panel on the first 'crm:peek' click
// and hands that click to it.
const CrmPeekPanelBody = dynamic(
  () => import('@/components/admin/CrmPeekPanelBody').then((m) => m.CrmPeekPanelBody),
  { ssr: false },
)

type PeekRequest = { id: string; kind: 'person' | 'org' }

/** Slide-over summary, opened from a list row. See CrmPeekPanelBody for the panel. */
export function CrmPeekPanel() {
  const [first, setFirst] = useState<PeekRequest | null>(null)

  useEffect(() => {
    if (first) return
    function onPeek(e: Event) {
      setFirst((e as CustomEvent<PeekRequest>).detail)
    }
    window.addEventListener('crm:peek', onPeek)
    return () => window.removeEventListener('crm:peek', onPeek)
  }, [first])

  // Once loaded, the panel listens for further clicks itself.
  return first ? <CrmPeekPanelBody initial={first} /> : null
}

/** Opens the panel. A plain button so it is keyboard-reachable like any link. */
export function CrmPeekButton({
  id, kind, children, className,
}: {
  id: string
  kind: 'person' | 'org'
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('crm:peek', { detail: { id, kind } }))}
      className={className ?? 'text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-brand'}
    >
      {children}
    </button>
  )
}
