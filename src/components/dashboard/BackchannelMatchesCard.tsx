'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContactQuickLink } from '@/components/dashboard/ContactQuickLink'
import type { BackchannelMatch } from '@/lib/network/backchannel'

const PAGE_SIZE = 5

export function BackchannelMatchesCard({ matches }: { matches: BackchannelMatch[] }) {
  const [page, setPage] = useState(0)
  if (matches.length === 0) return null

  const pageCount = Math.ceil(matches.length / PAGE_SIZE)
  const visible = matches.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <Card>
      <CardHeader>
        <CardTitle>You might know someone at these companies · {matches.length}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Backchanneling — having someone on the inside flag your application to the hiring
          manager — meaningfully raises your odds of getting a real look, versus the application
          sitting in a queue with hundreds of others. Here&apos;s who&apos;s already in your
          network at companies you&apos;ve applied to.
        </p>
        {visible.map((m) => (
          <div key={m.job.id} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-foreground">
              {m.job.companyName}
              {m.job.title ? ` — ${m.job.title}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
              <span>Who can help:</span>
              {m.contacts.map((c, i) => (
                <span key={c.id} className="flex items-center">
                  <ContactQuickLink name={c.name} email={c.email} linkedinUrl={c.linkedinUrl} className="text-xs" />
                  {i < m.contacts.length - 1 && <span className="text-muted-foreground">,</span>}
                </span>
              ))}
            </div>
          </div>
        ))}

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              Prev
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page === pageCount - 1}
              aria-label="Next page"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
