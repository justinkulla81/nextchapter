import type { EventMatch } from '@/lib/events/match'
import { ACCESS_LABEL, KIND_LABEL, SPEAKING_LABEL, type Access, type Speaking } from '@/lib/events/types'
import { costLabel, isPaid, whenLabel, whereLabel } from '@/lib/events/format'
import { setEventInterest } from '@/app/dashboard/network/events/actions'
import { ShowMore } from '@/components/candidate/ShowMore'
import { Chip } from '@/components/candidate/ui'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { cn } from '@/lib/utils'

// The ranked event list. A row carries a title, one reason it fits, the cost (the fact people ask first) and
// two actions. How to get in cheaper, how to speak and how to apply open under "How to get in".
const SHOWN = 5
const dateOnly = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function InterestButton({ eventId, status, current, children }: { eventId: string; status: 'SAVED' | 'GOING'; current?: string; children: string }) {
  const on = current === status
  return (
    <form action={setEventInterest}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        aria-pressed={on}
        className={cn('inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium', on ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted')}
      >
        {on ? `${children} ✓` : children}
      </button>
    </form>
  )
}

function Row({ m, rank, interest }: { m: EventMatch; rank: number; interest?: string }) {
  const e = m.event
  const paid = isPaid(e)
  const hasWays = !!(e.cheaperWays || e.speaking === 'OPEN_CFP' || e.speaking === 'BY_INVITE' || e.applyUrl || e.access === 'INVITE' || e.access === 'APPLY')
  return (
    <li className="space-y-2 rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold text-ink">{e.name}</h3>
        <span className="text-xs text-muted-foreground">{KIND_LABEL[e.kind as keyof typeof KIND_LABEL] ?? 'Event'}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {whenLabel(e)} · {whereLabel(e)}
      </p>
      <p className="text-sm text-ink">
        <span className="font-semibold">Why it fits:</span> {m.why}
        {e.whyAttend ? ` ${e.whyAttend}` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Chip tone={paid ? 'warm' : 'good'}>{ACCESS_LABEL[e.access as Access] ?? 'Paid ticket'}</Chip>
        <span className="text-ink">{costLabel(e)}</span>
      </div>

      {hasWays && (
        <details className="group text-sm">
          <summary className="cursor-pointer list-none font-medium text-brand underline underline-offset-4 [&::-webkit-details-marker]:hidden">How to get in or speak</summary>
          <ul className="mt-2 space-y-1.5 text-ink">
            {e.cheaperWays && (
              <li>
                <span className="font-semibold">Cheaper ways in:</span> {e.cheaperWays}
              </li>
            )}
            {(e.access === 'INVITE' || e.access === 'APPLY') && (
              <li>
                <span className="font-semibold">{e.access === 'APPLY' ? 'Apply to attend' : 'Invitation only'}:</span>{' '}
                {e.applyUrl ? (
                  <TrackedLink href={e.applyUrl} event="conference_event_apply_clicked" properties={{ eventId: e.id, access: e.access, rank }} className="text-brand underline underline-offset-4">
                    {e.access === 'APPLY' ? 'application page' : 'how invitations work'}
                  </TrackedLink>
                ) : (
                  'ask the organizer for an invitation'
                )}
                {e.applyDeadline ? `. Apply by ${dateOnly(e.applyDeadline)}.` : '.'}
              </li>
            )}
            {(e.speaking === 'OPEN_CFP' || e.speaking === 'BY_INVITE') && (
              <li>
                <span className="font-semibold">{SPEAKING_LABEL[e.speaking as Speaking]}:</span>{' '}
                {e.speakingNote ?? (e.speaking === 'OPEN_CFP' ? 'You can submit a talk.' : 'Organizers pick speakers; a warm introduction helps.')}
                {e.speakingDeadline ? ` Submit by ${dateOnly(e.speakingDeadline)}.` : ''}{' '}
                {e.speakingUrl && (
                  <TrackedLink href={e.speakingUrl} event="conference_event_speak_clicked" properties={{ eventId: e.id, speaking: e.speaking, rank }} className="text-brand underline underline-offset-4">
                    Speaker page
                  </TrackedLink>
                )}
              </li>
            )}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <TrackedLink
          href={e.url!}
          event="conference_event_clicked"
          properties={{ eventId: e.id, access: e.access, speaking: e.speaking, importance: e.importance, rank, score: m.score, surface: 'dashboard_events' }}
          className="inline-flex h-10 items-center rounded-full bg-action px-5 text-sm font-semibold text-action-foreground hover:brightness-95"
        >
          See the event
        </TrackedLink>
        <InterestButton eventId={e.id} status="GOING" current={interest}>I am going</InterestButton>
        <InterestButton eventId={e.id} status="SAVED" current={interest}>Save</InterestButton>
        {e.verified && e.checkedAt && <span className="text-xs text-muted-foreground">Checked on the event site {e.checkedAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
      </div>
    </li>
  )
}

export function EventList({ matches, interests }: { matches: EventMatch[]; interests: Record<string, string> }) {
  return (
    <section className="space-y-4" aria-label="Events">
      <ul className="space-y-3">
        {matches.slice(0, SHOWN).map((m, i) => (
          <Row key={m.event.id} m={m} rank={i + 1} interest={interests[m.event.id]} />
        ))}
      </ul>
      {matches.length > SHOWN && (
        <ShowMore label={`Show ${matches.length - SHOWN} more`} event="conference_events_show_more_opened">
          <ul className="space-y-3">
            {matches.slice(SHOWN).map((m, i) => (
              <Row key={m.event.id} m={m} rank={SHOWN + i + 1} interest={interests[m.event.id]} />
            ))}
          </ul>
        </ShowMore>
      )}
    </section>
  )
}
