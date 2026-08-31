'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Deep-link anchors (e.g. /dashboard/find-my-job#job-recommendations) land on
// pages whose body is wrapped in a single Suspense boundary (Gmail sync,
// LLM guidance, etc. — see FindMyJobBody's own comment), so the target
// element frequently doesn't exist in the DOM yet at the moment Next.js's
// native scroll-to-hash runs, and it never retries once the content streams
// in. Watch for the element to appear and scroll to it once it does.
export function HashScrollFix() {
  const pathname = usePathname()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))

    const tryScroll = () => {
      const el = document.getElementById(id)
      if (!el) return false
      // A closed <details> still satisfies getElementById for anything
      // inside it — real bug, not hypothetical: several deep-link targets
      // on this site sit inside a collapsed <details> (Interim Work's
      // launch plan, the Stats page's available-actions list), so this was
      // "scrolling" to a summary line with the promised content hidden
      // underneath it. Force open every <details> ancestor (including the
      // target itself, if it is one) before scrolling.
      let node: HTMLElement | null = el
      while (node) {
        if (node instanceof HTMLDetailsElement && !node.open) node.open = true
        node = node.parentElement
      }
      el.scrollIntoView({ block: 'start' })
      return true
    }

    if (tryScroll()) return

    const observer = new MutationObserver(() => {
      if (tryScroll()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const timeout = setTimeout(() => observer.disconnect(), 10000)
    return () => {
      observer.disconnect()
      clearTimeout(timeout)
    }
  }, [pathname])

  return null
}
