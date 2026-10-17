'use client'

import { useRef, useState, useTransition } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import type { JobContacts } from '@/lib/jobs/job-contacts'
import type { ContactTarget, WhoToContactPanel as Panel } from '@/lib/jobs/who-to-contact'
import { loadWhoToContact, requestKnownContactIntro } from '@/app/dashboard/find-my-job/who-to-contact-actions'
import { SentItPrompt } from '@/components/dashboard/SentItPrompt'

const linkClass = 'text-primary underline underline-offset-4'

/**
 * "Who to contact" on a board job. The member's own contacts and the search firm come
 * with the card (already loaded for the list); everything else loads only when the
 * member opens this section, so the board list itself makes no extra queries.
 */
export function WhoToContactPanel({
  postingId,
  confidential,
  contacts,
}: {
  postingId: string
  confidential: boolean
  contacts?: JobContacts
}) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, startLoading] = useTransition()
  const requested = useRef(false)

  function load() {
    setError(null)
    startLoading(async () => {
      try {
        const result = await loadWhoToContact(postingId)
        if (!result.ok) return setError(result.error)
        setPanel(result.panel)
        posthog.capture('who_to_contact_opened', { jobId: postingId, sources: result.panel.sources })
      } catch {
        setError('We couldn’t load contacts for this job. Check your connection and try again.')
      }
    })
  }

  return (
    <details
      className="group/who text-sm"
      onToggle={(e) => {
        if (!(e.currentTarget as HTMLDetailsElement).open || requested.current || confidential) return
        requested.current = true
        load()
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-foreground">
        Who to contact
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/who:rotate-180" aria-hidden />
      </summary>
      <div className="mt-2 space-y-4">
        {contacts && <OwnContacts contacts={contacts} />}

        {confidential ? (
          <p className="text-muted-foreground">
            This is a confidential search, so the employer isn’t named. Use “Request intro” below and we’ll connect you.
          </p>
        ) : loading && !panel ? (
          <p className="text-muted-foreground" role="status" aria-live="polite">
            Finding who to contact…
          </p>
        ) : error ? (
          <div className="space-y-2" role="alert">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} aria-busy={loading} className={loading ? 'cursor-wait' : ''}>
              {loading ? 'Trying again…' : 'Try again'}
            </Button>
          </div>
        ) : panel ? (
          <PanelBody panel={panel} />
        ) : null}
      </div>
    </details>
  )
}

function OwnContacts({ contacts }: { contacts: JobContacts }) {
  if (!contacts.firm && contacts.known.length === 0) return null
  return (
    <div className="space-y-1">
      {contacts.firm && (
        <p className="text-muted-foreground">
          Search firm:{' '}
          {contacts.firm.url ? (
            <a href={contacts.firm.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {contacts.firm.name}
            </a>
          ) : (
            contacts.firm.name
          )}{' '}
          — the consultant named on the posting runs this search.
        </p>
      )}
      {contacts.known.map((c) => (
        <p key={c.id} className="text-muted-foreground">
          <span className="text-foreground">You know {c.name}</span>
          {c.title && `, ${c.title}`}
          {c.role === 'recruiter' ? ' (recruiter)' : ' (likely hiring manager)'} —{' '}
          {c.email ? (
            <a href={`mailto:${c.email}`} className={linkClass}>
              {c.email}
            </a>
          ) : c.linkedinUrl ? (
            <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              LinkedIn
            </a>
          ) : (
            'no contact details saved'
          )}
        </p>
      ))}
    </div>
  )
}

function PanelBody({ panel }: { panel: Panel }) {
  const recruiting = panel.targets.filter((t) => t.kind === 'recruiter')
  const managers = panel.targets.filter((t) => t.kind === 'hiring_manager')
  return (
    <>
      {panel.recruiter && (
        <div className="space-y-1">
          <p className="text-foreground">
            Named on the posting: <span className="font-medium">{panel.recruiter.name}</span>
          </p>
          {panel.recruiter.guessedEmail && (
            <p className="text-muted-foreground">
              {panel.recruiter.guessedEmail}{' '}
              <span className="text-xs">(guessed from the company’s email format — verify before sending)</span>
            </p>
          )}
          <p>
            <SearchLink jobId={panel.jobId} kind="posting_contact" href={panel.recruiter.linkedinSearchUrl}>
              Find {panel.recruiter.name} on LinkedIn
            </SearchLink>
          </p>
        </div>
      )}

      {panel.knownSomeone && <KnownSomeone jobId={panel.jobId} orgId={panel.companyId} />}

      <TargetList
        heading="Recruiting and HR — titles to look for"
        targets={recruiting}
        jobId={panel.jobId}
      />
      {managers.length > 0 && (
        <TargetList
          heading={`Likely hiring manager${panel.hiringManagerBasis ? ` (this is a ${panel.hiringManagerBasis.toLowerCase()}-level role)` : ''}`}
          targets={managers}
          jobId={panel.jobId}
        />
      )}
      <p className="text-xs text-muted-foreground">
        These are likely titles, not confirmed people. Each link opens a LinkedIn people search you can check yourself.
      </p>

      <OutreachNote jobId={panel.jobId} template={panel.template} />
    </>
  )
}

function TargetList({ heading, targets, jobId }: { heading: string; targets: ContactTarget[]; jobId: string }) {
  return (
    <div className="space-y-1">
      <p className="text-foreground">{heading}</p>
      <ul className="space-y-1">
        {targets.map((t) => (
          <li key={t.title}>
            <SearchLink jobId={jobId} kind={t.kind} href={t.linkedinSearchUrl}>
              {t.title}
            </SearchLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SearchLink({ jobId, kind, href, children }: { jobId: string; kind: string; href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
      onClick={() => posthog.capture('contact_linkedin_search_clicked', { jobId, kind })}
    >
      {children}
    </a>
  )
}

function KnownSomeone({ jobId, orgId }: { jobId: string; orgId: string | null }) {
  const [pending, start] = useTransition()
  const [done, setDone] = useState<'sent' | 'already' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function ask() {
    setError(null)
    start(async () => {
      try {
        const result = await requestKnownContactIntro(jobId)
        if (!result.ok) return setError(result.error)
        setDone(result.already ? 'already' : 'sent')
        if (!result.already) posthog.capture('intro_requested', { jobId, orgId })
      } catch {
        setError('We couldn’t send your request. Try again in a moment.')
      }
    })
  }

  return (
    <div className="space-y-2 rounded-md bg-muted/50 p-3">
      <p className="text-foreground">NextChapter knows someone here — ask your coach for an intro.</p>
      {done ? (
        <p className="text-success" role="status">
          {done === 'already' ? 'You’ve already asked — your coach will follow up.' : 'Request sent. Your coach will follow up.'}
        </p>
      ) : (
        <Button size="sm" onClick={ask} disabled={pending} aria-busy={pending} className={cn(pending && 'cursor-wait')}>
          {pending ? 'Sending…' : 'Ask for an intro'}
        </Button>
      )}
      {error && <p className="text-destructive">{error}</p>}
    </div>
  )
}

function OutreachNote({ jobId, template }: { jobId: string; template: string }) {
  const [note, setNote] = useState(template)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [copySignal, setCopySignal] = useState(0)
  const id = `outreach-${jobId}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(note)
      setCopied(true)
      setCopyError(false)
      setCopySignal((n) => n + 1)
      posthog.capture('outreach_template_copied', { jobId })
    } catch {
      setCopyError(true)
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-foreground">
        Outreach note — edit, then send from your own email or LinkedIn
      </label>
      <textarea
        id={id}
        value={note}
        rows={9}
        onChange={(e) => {
          setNote(e.target.value)
          setCopied(false)
        }}
        className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
      />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy note'}
        </Button>
        {copyError && <p className="text-destructive">Couldn’t copy — select the text and copy it yourself.</p>}
      </div>
      <SentItPrompt context={{ source: 'who_to_contact', subjectKey: `job:${jobId}`, jobId }} note={note} copySignal={copySignal} />
      <p className="text-xs text-muted-foreground">NextChapter never sends this for you.</p>
    </div>
  )
}
