'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { watchForHumanInteraction } from '@/lib/posthog/human-interaction'

const SESSION_KEY = 'nc_human_interaction'

/** Sends `visitor_interacted` once per browser session, on the first real input (see src/lib/posthog/human-interaction.ts). */
export function HumanInteractionTracker() {
  const pathname = usePathname()

  useEffect(() => {
    let alreadySent = false
    try {
      alreadySent = sessionStorage.getItem(SESSION_KEY) === '1'
    } catch {
      // Storage blocked: the event may repeat on later pages, which a distinct-people report ignores.
    }
    if (alreadySent) {
      // Later pages of a session carry the property too, so an event-level filter works on them.
      posthog.register({ human_interaction: true })
      return
    }
    return watchForHumanInteraction(window, (kind) => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // Storage blocked; see above.
      }
      posthog.register({ human_interaction: true })
      posthog.capture('visitor_interacted', { kind, path: pathname })
    })
  }, [pathname])

  return null
}
