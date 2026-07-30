'use client'

import { useTransition } from 'react'
import { removeWatchlistCompany, viewWatchlistPosting } from '@/app/dashboard/company-tracker/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WatchedCompany {
  id: string
  companyName: string
  newPostingCount: number
}

export function CompanyWatchlistList({ companies }: { companies: WatchedCompany[] }) {
  const [isPending, startTransition] = useTransition()

  if (companies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing on your watchlist yet — add a company above to get notified when they post a new role.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {companies.map((company) => (
        <li key={company.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{company.companyName}</span>
            {company.newPostingCount > 0 && (
              <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">
                {company.newPostingCount} new
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('text-muted-foreground', isPending && 'cursor-progress')}
            onClick={() => startTransition(() => removeWatchlistCompany(company.id))}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  )
}

interface WatchedPosting {
  id: string
  title: string
  companyName: string
  location: string | null
  url: string
  isNew: boolean
}

export function WatchlistPostingsList({ postings }: { postings: WatchedPosting[] }) {
  if (postings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No open postings from your watched companies right now — you&apos;ll see them here the moment one shows up.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {postings.map((posting) => (
        <li key={posting.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div>
            <a
              href={posting.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void viewWatchlistPosting(posting.id, posting.companyName)}
              className="font-medium text-primary hover:underline"
            >
              {posting.title} at {posting.companyName}
            </a>
            {posting.location && <p className="text-sm text-muted-foreground">{posting.location}</p>}
          </div>
          {posting.isNew && (
            <span className="shrink-0 rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">New</span>
          )}
        </li>
      ))}
    </ul>
  )
}
