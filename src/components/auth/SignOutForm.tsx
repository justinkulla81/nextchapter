'use client'

import type { ComponentProps } from 'react'
import { posthog } from '@/lib/posthog/client'
import { clearMemberBrowserStorage } from '@/lib/security/clear-browser-storage'

/** Forgets the member in this browser: PostHog identity, then our local and session storage. */
export function forgetMemberInBrowser() {
  posthog.reset()
  clearMemberBrowserStorage()
}

/**
 * Every sign-out button's form. The server action ends the Supabase session;
 * this clears what the app kept in the browser at the same moment, so no
 * member data survives the logout (CASA 6.6.1).
 */
export function SignOutForm({ onSubmit, ...props }: ComponentProps<'form'>) {
  return (
    <form
      {...props}
      onSubmit={(e) => {
        forgetMemberInBrowser()
        onSubmit?.(e)
      }}
    />
  )
}
