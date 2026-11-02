'use client'

import { posthog } from '@/lib/posthog/client'

// "Read the full posting" on an excerpt-only job. It is a real link to the employer (so it still reads as one to crawlers), but
// for someone who has not given an email on this browser it opens the Apply prompt instead, so every way off the page asks first.
export const OPEN_APPLY_GATE_EVENT = 'nc:open-apply-gate'
export const EMAIL_GIVEN_KEY = 'nc_apply_email_given_v1'

export function ReadFullPostingLink({ href, jobId, company }: { href: string; jobId: string; company: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow noopener noreferrer"
      onClick={(e) => {
        let given = false
        try {
          given = !!localStorage.getItem(EMAIL_GIVEN_KEY)
        } catch {}
        if (given) {
          posthog.capture('public_job_apply_clicked', { jobId, company, placement: 'read_more', variant: 'returning' })
          return
        }
        e.preventDefault()
        posthog.capture('apply_gate_opened_from_read_more', { jobId, company })
        window.dispatchEvent(new Event(OPEN_APPLY_GATE_EVENT))
      }}
      className="font-semibold text-brand underline underline-offset-4"
    >
      Read the full posting on the employer&apos;s site
    </a>
  )
}
