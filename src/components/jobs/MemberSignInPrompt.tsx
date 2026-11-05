'use client'

import { useEffect, useRef, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { markSigninAsked, signinAsked } from '@/lib/jobs/signin-ask'

// A dismissible "Sign in" prompt on a public job page, for visitors who are members but not signed in here.
// Signed-in members never see this page (src/proxy.ts sends them to the same job in the portal). Signing in lands on that
// job in the portal; dismissing leaves the visitor on this page, and the prompt stays away for the rest of the browser session.
// It opens after a short pause so the job is read first, and is not a registration ask (no email is collected here).
const DELAY_MS = 2500

export function MemberSignInPrompt({ jobId, company }: { jobId: string; company: string }) {
  const [open, setOpen] = useState(false)
  const signInRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (signinAsked()) return
    const t = window.setTimeout(() => {
      setOpen(true)
      posthog.capture('job_page_signin_prompt_shown', { jobId, company })
    }, DELAY_MS)
    return () => window.clearTimeout(t)
  }, [jobId, company])

  function close(how: 'stay' | 'escape' | 'backdrop') {
    markSigninAsked()
    posthog.capture('job_page_signin_prompt_dismissed', { jobId, company, how })
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    signInRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close('escape')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => close('backdrop')}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-signin-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="member-signin-title" className="text-lg font-semibold">Already have an account?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to open this job in your NextChapter account, where your saves and applications are tracked.</p>
        <a
          ref={signInRef}
          href={`/auth/login?next=${encodeURIComponent(`/dashboard/jobs/${jobId}?src=public_page`)}`}
          onClick={() => {
            markSigninAsked()
            posthog.capture('job_page_signin_prompt_clicked', { jobId, company })
          }}
          className={cn(buttonVariants({ size: 'lg' }), 'mt-4 h-11 w-full rounded-full bg-action text-action-foreground hover:brightness-95')}
        >
          Sign in
        </a>
        <button type="button" onClick={() => close('stay')} className="mt-3 block w-full text-center text-sm text-muted-foreground underline underline-offset-4">
          Stay on this page
        </button>
      </div>
    </div>
  )
}
