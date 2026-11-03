'use client'

import { useEffect, useState } from 'react'
import { posthog } from '@/lib/posthog/client'

/** On a phone the form scrolls out of view. This bar brings the visitor back to it once the first form has gone. */
export function StickyCta({ label, offer }: { label: string; offer: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('lead-hero-form')
    if (!hero || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  if (!show) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white p-3 lg:hidden">
      <a
        href="#lead-hero-form"
        onClick={() => posthog.capture('lead_sticky_clicked', { offer })}
        className="flex h-12 w-full items-center justify-center rounded-full bg-action text-base font-semibold text-action-foreground"
      >
        {label}
      </a>
    </div>
  )
}
