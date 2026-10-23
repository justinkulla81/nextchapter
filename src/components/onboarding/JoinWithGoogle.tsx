'use client'

import { useEffect, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// The one primary action on the sign-up screen. A real link (so it works before
// the page has hydrated); the click only adds the busy state and the event.
export function JoinWithGoogle() {
  const [pending, setPending] = useState(false)

  // Coming back with the browser's Back button restores the page from cache
  // with the busy state still on; clear it.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false)
    }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  // A plain link with the button styling (not the Button's link-as-button mode)
  // so it is announced and behaves as the link it is.
  return (
    <a
      href="/api/auth/join/start"
      aria-busy={pending}
      onClick={() => {
        setPending(true)
        posthog.capture('onboarding_google_started')
      }}
      className={cn(buttonVariants(), 'w-full sm:w-auto', pending && 'cursor-progress')}
    >
      {pending ? 'Opening Google…' : 'Continue with Google'}
    </a>
  )
}
