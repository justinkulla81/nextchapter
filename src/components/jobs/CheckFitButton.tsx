'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { markSigninAsked, signinAsked } from '@/lib/jobs/signin-ask'

// "Check my fit" on a public job page. Anyone who already has an account would otherwise answer the onboarding questions and upload a résumé
// before the app can tell (it only learns the email then), so the click first asks: sign in, or carry on as new. Members whose browser the site
// recognises never get here (src/proxy.ts sends them to the job in the portal). Answering either account question on the page is remembered for the browser session (src/lib/jobs/signin-ask.ts).

export function CheckFitButton({ jobId, href, placement, className }: { jobId: string; href: string; placement: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const signInRef = useRef<HTMLAnchorElement>(null)
  const props = { placement: `job_page_${placement}`, jobId }

  useEffect(() => {
    if (!open) return
    signInRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={(e) => {
          posthog.capture('jobs_page_personalize_clicked', props)
          if (signinAsked()) return
          e.preventDefault()
          posthog.capture('fit_signin_ask_shown', props)
          setOpen(true)
        }}
      >
        Check my fit
      </Link>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="fit-ask-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="fit-ask-title" className="text-lg font-semibold">Do you already have an account?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Members see their fit right away, with no questions to answer again.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a
                ref={signInRef}
                href={`/auth/login?next=${encodeURIComponent(`/dashboard/jobs/${jobId}?src=check_fit`)}`}
                onClick={() => posthog.capture('fit_signin_ask_answered', { ...props, answer: 'sign_in' })}
                className={cn(buttonVariants({ size: 'lg' }), 'h-11 flex-1 rounded-full bg-action text-action-foreground hover:brightness-95')}
              >
                Yes, sign in
              </a>
              <Link
                href={href}
                onClick={() => {
                  markSigninAsked()
                  posthog.capture('fit_signin_ask_answered', { ...props, answer: 'new' })
                }}
                className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'h-11 flex-1 rounded-full')}
              >
                No, I&apos;m new
              </Link>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="mt-3 block w-full text-center text-sm text-muted-foreground underline underline-offset-4">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
