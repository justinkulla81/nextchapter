'use client'

import { useEffect, useRef } from 'react'
import { posthog } from '@/lib/posthog/client'

// Records that a pivot path was actually seen (scrolled into view), once per card per visit, with what a
// query on "which pivots do people look at, and how close were they" would need.
export function PivotPathImpression({
  fromSoc,
  toSoc,
  similarity,
  rank,
  payBasis,
  children,
}: {
  fromSoc: string
  toSoc: string
  similarity: number
  rank: number
  payBasis: string | null
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || fired.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (fired.current || !entries.some((e) => e.isIntersecting)) return
        fired.current = true
        posthog.capture('pivot_path_viewed', { fromSoc, toSoc, similarity: Math.round(similarity * 100) / 100, rank, payBasis })
        observer.disconnect()
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [fromSoc, toSoc, similarity, rank, payBasis])

  return <div ref={ref}>{children}</div>
}
