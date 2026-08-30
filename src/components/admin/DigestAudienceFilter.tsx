'use client'

import { useRef } from 'react'

const DIGEST_AUDIENCE_OPTIONS = [
  { value: 'candidate', label: 'Candidates' },
  { value: 'coach', label: 'Coaches' },
  { value: 'recruiter', label: 'Recruiters' },
  { value: 'employer', label: 'Employers' },
]

// A second filter control on the same /support/admin/research page as the
// Market Pulse table's own AdminFilterBar — can't reuse that component
// here, since its search box hardcodes name="q" and submitting a second
// form with the same field would blank out whatever the candidate had
// searched for above. Hidden inputs carry the other page filters forward
// so changing the digest audience doesn't reset them.
export function DigestAudienceFilter({
  q,
  bucket,
  status,
  credibility,
  digestAudience,
}: {
  q: string
  bucket: string
  status: string
  credibility: string
  digestAudience: string
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} method="get" action="/support/admin/research" className="flex items-center gap-3">
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="bucket" value={bucket} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="credibility" value={credibility} />
      <select
        name="digestAudience"
        defaultValue={digestAudience}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      >
        <option value="">Audience: All</option>
        {DIGEST_AUDIENCE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {digestAudience && (
        <a
          href={`/support/admin/research?${new URLSearchParams({ q, bucket, status, credibility }).toString()}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Clear
        </a>
      )}
    </form>
  )
}
