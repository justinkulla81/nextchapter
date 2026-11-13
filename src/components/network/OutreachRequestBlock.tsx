'use client'

import { useActionState, useEffect, useState } from 'react'
import { submitOutreachRequest, type OutreachRequestState } from '@/lib/leads/outreach-request-actions'
import { readOutreachTags, type OutreachTags } from '@/lib/outreach/landing-tags'
import { posthog } from '@/lib/posthog/client'

const people = (n: number | null) => (n && n > 1 ? `${n.toLocaleString('en-US')} people` : 'people')

const COPY = {
  hr: {
    heading: (e: string, n: number | null) => `${people(n)} are leaving ${e}. Give them a place to start.`,
    points: () => ['Up to 10 seats at no charge', 'You see counts of who used it, never names', 'Free for them whether or not you partner with us'],
    body: 'Give us your work email and Justin Kulla will write to you to set it up.',
    button: 'Set up the 10 seats',
    done: 'Got it. Justin Kulla will email you to set up the seats.',
  },
  partner: {
    heading: (e: string, n: number | null) => `Someone from ${e} may walk in. Have this ready.`,
    points: (n: number | null) => [`A free page for the ${people(n)} leaving, with roles matched to their work`, 'A short note you can hand out, with the link', 'Nothing for you to set up'],
    body: 'Give us your work email and Justin Kulla will send you the handout.',
    button: 'Send me the handout',
    done: 'Got it. Justin Kulla will email you the handout.',
  },
} as const

/**
 * Shown only to someone who arrived from a layoff outreach email (HR, a job center, a workforce board, Rapid Response): one
 * field that turns "reply to the email" into a trackable request. Everyone else sees nothing. The visitor reads the tags in the
 * browser so the page stays static and cached. `forceTags` is for the preview page. Owner approved this as a second
 * registration ask on a public page on 2026-11-13.
 */
export function OutreachRequestBlock({ slug, employer, people: peopleCount = null, forceTags }: { slug: string; employer: string; people?: number | null; forceTags?: OutreachTags }) {
  const [tags, setTags] = useState<OutreachTags | null>(forceTags ?? null)
  useEffect(() => {
    if (forceTags) return
    const t = readOutreachTags(window.location.search)
    if (t) { setTags(t); posthog.capture('outreach_landing_viewed', { slug, role: t.role, audience: t.audience, arm: t.arm, noticeId: t.noticeId }) }
  }, [slug, forceTags])
  const [state, submit, sending] = useActionState<OutreachRequestState, FormData>(submitOutreachRequest, undefined)
  if (!tags) return null
  const c = COPY[tags.role]

  return (
    <section aria-labelledby="outreach-request" className="mt-4 rounded-2xl border-2 border-[var(--org-1,#14213D)] bg-white p-6 sm:p-8">
      <h2 id="outreach-request" className="text-balance text-xl font-bold tracking-tight text-[var(--org-1,#14213D)] sm:text-2xl">{c.heading(employer, peopleCount)}</h2>
      {state?.saved ? (
        <p role="status" className="mt-3 text-base font-semibold text-[var(--org-1,#14213D)]">{c.done}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-1 text-sm text-navy">
            {c.points(peopleCount).map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="text-[var(--org-1,#14213D)]">✓</span><span>{t}</span></li>)}
          </ul>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{c.body}</p>
          <form
            action={submit}
            noValidate
            className={`mt-4 flex max-w-xl flex-col gap-3 sm:flex-row ${sending ? 'cursor-wait' : ''}`}
            onSubmit={() => posthog.capture('outreach_request_clicked', { slug, role: tags.role, audience: tags.audience, arm: tags.arm, noticeId: tags.noticeId })}
          >
            <input type="hidden" name="company" value={employer} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="role" value={tags.role} />
            <input type="hidden" name="audience" value={tags.audience} />
            <input type="hidden" name="arm" value={tags.arm} />
            <input type="hidden" name="noticeId" value={tags.noticeId} />
            <div className="hidden" aria-hidden>
              <label htmlFor="outreach-website">Website</label>
              <input id="outreach-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <label htmlFor="outreach-email" className="sr-only">Your work email</label>
            <input
              id="outreach-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={state?.email}
              placeholder="you@yourorganization.org"
              aria-invalid={state?.error ? true : undefined}
              className="h-12 w-full rounded-lg border border-border bg-white px-4 text-base text-[#111111] sm:flex-1"
            />
            <button type="submit" disabled={sending} className="h-12 rounded-full bg-[var(--org-1,#14213D)] px-6 text-base font-semibold text-[var(--org-1-ink,#ffffff)] hover:brightness-95 disabled:cursor-wait">
              {sending ? 'Sending…' : c.button}
            </button>
          </form>
          {state?.error && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{state.error}</p>}
        </>
      )}
    </section>
  )
}
