'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'

// A member whose login has lapsed opens a public job page, is sent to the portal, finds no session there and comes back here with ?stay=1
// (src/proxy.ts). This tells them what happened and gives them the way in, instead of leaving only the small header link. It reads the
// query in the browser, so the page itself stays cached for everyone. Nobody else sees it.
function Banner({ jobId, company }: { jobId: string; company: string }) {
  const stay = useSearchParams().get('stay') === '1'
  useEffect(() => {
    if (stay) posthog.capture('job_signin_prompt_shown', { jobId, company, placement: 'returning_member' })
  }, [stay, jobId, company])
  if (!stay) return null
  const next = encodeURIComponent(`/dashboard/jobs/${jobId}?src=public_page`)
  return (
    <div role="status" className="mt-4 flex flex-col gap-3 rounded-2xl bg-tint-sky p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink">
        <span className="font-semibold">Welcome back.</span> Log in to see how this job fits you and keep it in your search.
      </p>
      <a
        href={`/auth/login?next=${next}`}
        onClick={() => posthog.capture('job_signin_prompt_clicked', { jobId, company, placement: 'returning_member' })}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-navy bg-white px-5 text-sm font-semibold text-navy hover:bg-white/80"
      >
        Log in
      </a>
    </div>
  )
}

export function ReturningMemberBanner(props: { jobId: string; company: string }) {
  return (
    <Suspense fallback={null}>
      <Banner {...props} />
    </Suspense>
  )
}
