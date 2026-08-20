'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { confirmIdentityMatch, rejectIdentityMatch } from '@/app/support/admin/(portal)/identity-matches/actions'
import { cn } from '@/lib/utils'

const SOURCE_LABEL: Record<string, string> = {
  REFERENCE: 'Named as a reference',
  COACH_INVITE: "A coach's invited client",
  RECRUITER_LEAD: "A recruiter's sourced lead",
  CONTACT: "Someone else's contact",
}

const STRENGTH_LABEL: Record<string, string> = {
  EMAIL_EXACT: 'Exact email match',
  PHONE_EXACT: 'Exact phone match',
  FUZZY_NAME_WORK_LOCATION: 'Name + work history match (no email/phone on file)',
}

interface IdentityMatchRowProps {
  id: string
  candidateName: string
  candidateEmail: string
  source: string
  strength: string
  matchedName: string | null
  matchedEmail: string | null
  matchedCompany: string | null
  status: string
  createdAt: string
}

export function IdentityMatchRow(match: IdentityMatchRowProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className={cn('space-y-3 rounded-lg border border-border p-4', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">
            {match.candidateName} <span className="text-muted-foreground">({match.candidateEmail})</span>
          </p>
          <p className="text-sm text-foreground">
            {SOURCE_LABEL[match.source] ?? match.source}
            {match.matchedName && ` — as "${match.matchedName}"`}
            {match.matchedEmail && ` (${match.matchedEmail})`}
            {match.matchedCompany && ` at ${match.matchedCompany}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {STRENGTH_LABEL[match.strength] ?? match.strength} · Flagged {match.createdAt}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase',
            match.status === 'CONFIRMED' && 'bg-success/10 text-success',
            match.status === 'REJECTED' && 'bg-destructive/10 text-destructive',
            match.status === 'PENDING' && 'bg-orange/10 text-orange'
          )}
        >
          {match.status}
        </span>
      </div>

      {match.status === 'PENDING' && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => startTransition(() => confirmIdentityMatch(match.id))}
          >
            Confirm — same person
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => startTransition(() => rejectIdentityMatch(match.id))}
          >
            Not a match
          </Button>
        </div>
      )}
    </div>
  )
}
