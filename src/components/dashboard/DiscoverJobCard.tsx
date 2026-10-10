'use client'

import { useActionState, useState, useTransition } from 'react'
import { Lock, ChevronDown } from 'lucide-react'
import type { ExclusiveJobPosting } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { promoteJobBoardListing, requestJobBoardIntro, recordJobClick, draftJobCoverNote } from '@/app/dashboard/find-my-job/actions'
import { FIT_BUCKET_LABEL, isRecentlyListed, type FitBucket } from '@/lib/jobs/fit-bucket-types'
import { AddToWatchlistButton } from '@/components/dashboard/AddToWatchlistButton'
import { cn } from '@/lib/utils'
import { seniorityLabel } from '@/lib/jobs/job-seniority'
import { edgeHeadline, edgeTip, isFresh, postedAgo, type CompetitionScore } from '@/lib/jobs/competition'
import type { JobContacts } from '@/lib/jobs/job-contacts'
import posthog from 'posthog-js'

const POSTING_TYPE_LABEL: Record<string, string> = {
  direct: 'Direct Employer',
  recruiter_search: 'Recruiter-Led Search',
}

const FIT_BUCKET_STYLE: Record<FitBucket, string> = {
  strong: 'bg-success/10 text-success',
  good: 'bg-brand/10 text-brand',
  stretch: 'bg-muted text-muted-foreground',
  below_level: 'bg-muted text-muted-foreground',
  overqualified: 'bg-muted text-muted-foreground',
}

function FitBadge({ bucket }: { bucket: FitBucket }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', FIT_BUCKET_STYLE[bucket])}>
      {FIT_BUCKET_LABEL[bucket]}
    </span>
  )
}

// Seniority of the role, from its title (job-seniority.ts) — e.g.
// "Director", "Senior individual". Absent for postings with no level
// (employer and recruiter submissions aren't levelled).
function SeniorityBadge({ level }: { level: string | null }) {
  const label = seniorityLabel(level)
  if (!label) return null
  return <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{label}</span>
}

// Jobs found through an aggregator (Himalayas, The Muse, Remote OK…) carry
// a "Listed on X" badge from the import; their terms ask us to name them,
// and "View posting" links to their listing.
function attributionOf(posting: Pick<ExclusiveJobPosting, 'badges'>): string | null {
  return posting.badges.find((b) => b.startsWith('Listed on ')) ?? null
}

// The first 72 hours after posting are when an application stands out.
function FreshBadge({ posting }: { posting: Pick<ExclusiveJobPosting, 'postedAt' | 'createdAt'> }) {
  if (!isFresh(posting)) return null
  return (
    <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">
      {postedAgo(posting)} · apply first
    </span>
  )
}

function LowCompetitionBadge({ competition }: { competition?: CompetitionScore }) {
  if (competition?.level !== 'low') return null
  return (
    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success" title={competition.reasons.join(' · ')}>
      Low competition
    </span>
  )
}

const COMPETITION_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const

function NewBadge() {
  return <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">New</span>
}

// Marks a job that matches title, target industry, AND location/remote —
// the "ideal" tier from the title-only "broader" match everything else in
// this list is filtered to (see isIdealMatch in job-fit-bucket.ts).
function IdealMatchBadge() {
  return <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Ideal match</span>
}

// Candidate+-only listing a candidate without it can't see yet — shown
// masked rather than omitted, so the board itself is a visible reason to
// unlock Candidate+ instead of a wall these candidates never even know
// exists. Real title and location are shown (never the company name, which
// is the actual Candidate+-only reveal) — a flush row in the same list as
// the unlocked cards above it, styled like Application Tracker rows rather
// than a separately boxed/tinted callout, so the list reads as one
// continuous list.
export function LockedDiscoverJobCard({
  posting,
  fitBucket,
}: {
  posting: Pick<ExclusiveJobPosting, 'title' | 'location' | 'level'>
  // Optional — omitted for the (now rare) locked posting a fit bucket
  // couldn't be computed for. Same FitBadge as the unlocked cards, so
  // "why does this one deserve unlocking" reads the same way in both states.
  fitBucket?: FitBucket
}) {
  return (
    <div className="flex items-start gap-2 px-4 py-3">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">{posting.title}</p>
          <SeniorityBadge level={posting.level} />
          {fitBucket && <FitBadge bucket={fitBucket} />}
        </div>
        {posting.location && <p className="truncate text-sm text-muted-foreground">{posting.location}</p>}
      </div>
    </div>
  )
}

export function DiscoverJobCard({
  posting,
  fitBucket,
  idealMatch,
  competition,
  contacts,
}: {
  posting: ExclusiveJobPosting
  fitBucket: FitBucket
  idealMatch?: boolean
  competition?: CompetitionScore
  contacts?: JobContacts
}) {
  const [state, formAction, pending] = useActionState(promoteJobBoardListing.bind(null, posting.id), undefined)
  const confidential = posting.disclosure === 'CONFIDENTIAL'

  function handleClick() {
    void recordJobClick({
      source: 'job_board',
      sourceId: posting.id,
      jobTitle: posting.title,
      companyName: posting.companyName,
      location: posting.location,
      url: posting.url,
      fitBucket,
    })
  }

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-medium text-foreground">{posting.title}</span>
            <span className="truncate text-sm text-muted-foreground">
              {confidential ? 'Confidential search' : `at ${posting.companyName}`}
            </span>
          </span>
          {/* The edge, visible without opening the card. */}
          <span className="mt-0.5 block text-xs text-muted-foreground">{edgeHeadline(posting, competition)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {isFresh(posting) ? <FreshBadge posting={posting} /> : isRecentlyListed(posting.createdAt) && <NewBadge />}
          <LowCompetitionBadge competition={competition} />
          <SeniorityBadge level={posting.level} />
          {idealMatch && <IdealMatchBadge />}
          <FitBadge bucket={fitBucket} />
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <p className="text-sm text-muted-foreground">
          {attributionOf(posting) ?? (posting.postingType && POSTING_TYPE_LABEL[posting.postingType])}
          {posting.location && ` · ${posting.location}`}
          {posting.salaryMin && posting.salaryMax &&
            ` · ${posting.salaryCurrency ?? 'USD'} ${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`}
        </p>

        {/* A confidential search's description usually names the client — never shown. */}
        {posting.description && !confidential && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{posting.description}</p>
        )}

        {competition && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Competition: {COMPETITION_LABEL[competition.level]}</span>
            {competition.reasons.length > 0 && ` — ${competition.reasons.join(' · ')}`}
          </p>
        )}
        <p className="text-sm text-foreground">
          <span className="font-medium">Your edge:</span> {edgeTip(posting)}
        </p>
        {contacts && <WhoToContact contacts={contacts} />}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {confidential ? (
            <RequestIntroButton postingId={posting.id} />
          ) : (
            <Button
              nativeButton={false}
              render={<a href={posting.url} target="_blank" rel="noopener noreferrer" onClick={handleClick} />}
              variant="outline"
              size="sm"
            >
              View posting
            </Button>
          )}
          {state?.jobPostingId ? (
            <p className="text-sm text-success">Added to My Applications, with a full fit analysis below.</p>
          ) : (
            <form action={formAction}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Analyzing…" className={pending ? 'cursor-progress' : ''}>
                See full fit &amp; tailor your approach
              </SubmitButton>
            </form>
          )}
          {!confidential && <AddToWatchlistButton companyName={posting.companyName} />}
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <CoverNote postingId={posting.id} />
      </div>
    </details>
  )
}

function RequestIntroButton({ postingId }: { postingId: string }) {
  return (
    <form action={requestJobBoardIntro.bind(null, postingId)}>
      <SubmitButton variant="outline" size="sm" pendingLabel="Sending…">
        Request intro
      </SubmitButton>
    </form>
  )
}

function WhoToContact({ contacts }: { contacts: JobContacts }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-foreground">Who to contact</p>
      {contacts.firm && (
        <p className="text-muted-foreground">
          Search firm:{' '}
          {contacts.firm.url ? (
            <a href={contacts.firm.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
              {contacts.firm.name}
            </a>
          ) : (
            contacts.firm.name
          )}{' '}
          — the consultant named on the posting runs this search.
        </p>
      )}
      {contacts.recruiters.map((r) => (
        <p key={r.email} className="text-muted-foreground">
          {r.name}
          {r.title && `, ${r.title}`} —{' '}
          <a href={`mailto:${r.email}`} className="text-primary underline underline-offset-4">
            {r.email}
          </a>
        </p>
      ))}
      <p className="text-muted-foreground">
        <a href={contacts.linkedinSearchUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
          Find recruiters there on LinkedIn
        </a>
      </p>
    </div>
  )
}

// Drafted on click (an LLM call, capped per day — see cover-note.ts).
function CoverNote({ postingId }: { postingId: string }) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function draft() {
    setError(null)
    startTransition(async () => {
      const result = await draftJobCoverNote(postingId)
      if (!result.ok) return setError(result.error)
      setNote(result.body)
      setRemaining(result.remainingToday)
    })
  }

  async function copy() {
    if (!note) return
    await navigator.clipboard.writeText(note)
    setCopied(true)
    posthog.capture('job_cover_note_copied', { postingId })
  }

  if (!note) {
    return (
      <div className="space-y-1">
        <Button variant="outline" size="sm" onClick={draft} disabled={pending} aria-busy={pending} className={pending ? 'cursor-wait' : ''}>
          {pending ? 'Drafting…' : 'Draft a cover note'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground" htmlFor={`cover-note-${postingId}`}>
        Cover note — edit before you send
      </label>
      <textarea
        id={`cover-note-${postingId}`}
        defaultValue={note}
        rows={8}
        className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy note'}
        </Button>
        {remaining !== null && (
          <p className="text-xs text-muted-foreground">{remaining} more drafts available today</p>
        )}
      </div>
    </div>
  )
}
