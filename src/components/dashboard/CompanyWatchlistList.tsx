'use client'

import { useState, useTransition } from 'react'
import { removeWatchlistCompany, viewWatchlistPosting } from '@/app/dashboard/company-tracker/actions'
import { Button } from '@/components/ui/button'
import { isRecentlyListed } from '@/lib/jobs/fit-bucket-types'
import { cn } from '@/lib/utils'

export interface WatchlistPosting {
  id: string
  title: string
  companyName: string
  location: string | null
  url: string
  createdAt: Date
}

export interface WatchlistEntry {
  id: string
  companyName: string
  newPostingCount: number
  visiblePostings: WatchlistPosting[]
  lockedCount: number
}

export function CompanyWatchlist({ entries }: { entries: WatchlistEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing on your watchlist yet — add a company above to get notified when they post a new role.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {entries.map((entry) => {
        const openCount = entry.visiblePostings.length
        const canExpand = openCount > 0
        const expanded = canExpand && expandedId === entry.id

        return (
          <li key={entry.id}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                disabled={!canExpand}
                onClick={() => setExpandedId(expanded ? null : entry.id)}
                className={cn(
                  'flex flex-1 flex-wrap items-center gap-2 text-left',
                  canExpand ? 'cursor-pointer' : 'cursor-default'
                )}
              >
                <span className="text-sm font-medium text-foreground">{entry.companyName}</span>
                <span className="text-sm text-muted-foreground">
                  {openCount > 0
                    ? `${openCount} job${openCount === 1 ? '' : 's'} from ${entry.companyName} recommended for you`
                    : `0 new jobs from ${entry.companyName} recommended for you at this time`}
                  {entry.lockedCount > 0 &&
                    ` (+${entry.lockedCount} A-List only)`}
                </span>
                {entry.newPostingCount > 0 && (
                  <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">
                    {entry.newPostingCount} new
                  </span>
                )}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('shrink-0 text-muted-foreground', isPending && 'cursor-progress')}
                onClick={() => startTransition(() => removeWatchlistCompany(entry.id))}
              >
                Remove
              </Button>
            </div>

            {expanded && (
              <ul className="space-y-2 px-4 pb-3">
                {entry.visiblePostings.map((posting) => (
                  <li
                    key={posting.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div>
                      <a
                        href={posting.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void viewWatchlistPosting(posting.id, posting.companyName)}
                        className="font-medium text-primary hover:underline"
                      >
                        {posting.title}
                      </a>
                      {posting.location && <p className="text-sm text-muted-foreground">{posting.location}</p>}
                    </div>
                    {isRecentlyListed(posting.createdAt) && (
                      <span className="shrink-0 rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">
                        New
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
