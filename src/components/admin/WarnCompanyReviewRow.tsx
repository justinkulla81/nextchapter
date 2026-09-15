'use client'

import { useState } from 'react'
import { resolveWarnCompanyMatch, createNewCompanyForNotice } from '@/app/support/admin/(portal)/crm/warn/actions'

export function WarnCompanyReviewRow({
  noticeId,
  employer,
  candidates,
}: {
  noticeId: string
  employer: string
  candidates: { id: string; name: string }[]
}) {
  const [resolved, setResolved] = useState(false)
  const [pending, setPending] = useState(false)

  if (resolved) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-0">
      <div>
        <p className="font-medium">{employer}</p>
        <p className="text-xs text-muted-foreground">Could be one of these already-known companies — or a different one.</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {candidates.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              await resolveWarnCompanyMatch(noticeId, c.id)
              setResolved(true)
            }}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Same as “{c.name}”
          </button>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            await createNewCompanyForNotice(noticeId)
            setResolved(true)
          }}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          Not the same — new company
        </button>
      </div>
    </div>
  )
}
