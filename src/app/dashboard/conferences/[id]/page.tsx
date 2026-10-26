import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { seriesDetail } from '@/lib/conferences/queries'
import { OPPORTUNITY_LABEL, TALK_KIND_LABEL, TRACK_LABEL, TRACK_STATUSES, USER_STATUSES, USER_STATUS_LABEL, type OpportunityType, type TalkKind, type TrackStatus, type UserStatus } from '@/lib/conferences/constants'
import { costLabel, whenLabel, whereLabel } from '@/lib/events/format'
import type { ConferenceRow } from '@/lib/events/types'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip } from '@/components/candidate/ui'
import { ShowMore } from '@/components/candidate/ShowMore'
import { StatusSelect } from '@/components/conferences/StatusSelect'
import { canEditEntry } from '@/lib/conferences/entry-rules'
import { addTalkAction, editEntryAction, logPeopleAction, removeOpportunityAction, resolveChangeAction, saveNotesAction, setStatusAction, setTrackAction } from '../actions'

export const metadata: Metadata = { title: 'Conference' }
const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink'
const small = 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted'

const READ_NOTE: Record<string, string> = {
  walled: 'That site does not let us read its pages, so we added it from the link. Edit anything below.',
  failed: 'We could not read that page, so we added it from the link. Edit anything below.',
  limit: 'You have added a lot of links today, so we added this one without reading it. Edit anything below.',
}

export default async function ConferencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ read?: string }> }) {
  const { id } = await params
  const { read } = await searchParams
  const profile = await getDashboardData()
  const d = await seriesDetail(profile.id, id).catch(() => null)
  if (!d) notFound()
  const { series, uc, opportunities, tracks, changes, talks, contacts, windowLines, editions } = d
  const row = series as ConferenceRow
  const trackBy = new Map(tracks.map((t) => [t.opportunityId, t.status]))
  after(() => captureServerEvent(profile.id, 'conference_detail_viewed', { seriesId: id, tracked: !!uc, opportunities: opportunities.length, pendingChanges: changes.length }))
  const canEdit = canEditEntry(series, profile.id)
  const edition = editions.find((e) => e.status === 'TBA' || e.status === 'CONFIRMED')
  const when = edition?.status === 'TBA' && !series.datesConfirmed ? 'Dates TBA' : whenLabel(row)

  return (
    <div className="space-y-8">
      <PageHeader
        title={series.name}
        intro={[series.organizer, when, whereLabel(row), costLabel(row)].filter(Boolean).join(' · ')}
        action={
          <StatusSelect
            action={setStatusAction} hidden={{ seriesId: id }} value={uc?.status ?? null} label="Your status" none="Track this conference" event="user_conference_status_changed"
            options={USER_STATUSES.map((s) => ({ value: s, label: USER_STATUS_LABEL[s as UserStatus] }))}
          />
        }
      />
      {read && READ_NOTE[read] && <p className="rounded-2xl bg-muted p-4 text-sm text-ink">{READ_NOTE[read]}</p>}
      {series.url && <p className="text-sm"><a href={series.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-4">Open the conference site</a></p>}

      {changes.length > 0 && (
        <section aria-label="New details to confirm" className="space-y-3 rounded-2xl bg-muted p-5">
          <h2 className="font-display text-xl font-semibold text-ink">We found new details. Do they look right?</h2>
          <p className="text-sm text-muted-foreground">We re-read the conference site each week. Nothing changes until you confirm.</p>
          <ul className="space-y-3">
            {changes.map((c) => {
              const p = c.payload as Record<string, unknown>
              const text = c.kind === 'DATES' ? `New dates: ${p.start} to ${p.end}`
                : c.kind === 'NEW_OPPORTUNITY' ? `New: ${OPPORTUNITY_LABEL[(p.opportunity as { type: OpportunityType }).type]}, ${(p.opportunity as { title: string }).title}`
                : `Deadline for ${p.title} is now ${p.to}${p.from ? ` (was ${p.from})` : ''}`
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
                  <span>{text}</span>
                  <span className="flex gap-2">
                    {([['APPLY', 'Yes, update'], ['DISMISS', 'No, ignore']] as const).map(([a, label]) => (
                      <form key={a} action={resolveChangeAction}><input type="hidden" name="changeId" value={c.id} /><input type="hidden" name="action" value={a} /><button type="submit" className={small}>{label}</button></form>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-label="Ways to take part" className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Ways to take part</h2>
        {windowLines.length > 0 && <p className="text-sm text-muted-foreground">{windowLines.join(' ')}</p>}
        {opportunities.length === 0 ? (
          <p className="text-base text-muted-foreground">We have not found any calls, awards or contests for this conference yet. We re-check its site every week.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {opportunities.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-ink">{o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">{o.title}</a> : o.title}</p>
                  <p className="text-sm text-muted-foreground">{OPPORTUNITY_LABEL[o.type as OpportunityType]}{o.opensAt ? ` · opens ${dayLabel(o.opensAt)}` : ''}{o.deadline ? ` · closes ${dayLabel(o.deadline)}` : ''}</p>
                  {o.eligibility && <Chip>{o.eligibility}</Chip>}
                </div>
                {canEdit && (
                  <form action={removeOpportunityAction}>
                    <input type="hidden" name="opportunityId" value={o.id} />
                    <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4" aria-label={`Remove ${o.title}`}>Not right? Remove</button>
                  </form>
                )}
                {uc && o.type !== 'REGISTRATION' && (
                  <StatusSelect
                    action={setTrackAction} hidden={{ opportunityId: o.id }} value={trackBy.get(o.id) ?? null} label={`Your stage for ${o.title}`} none="Not tracking" event="conference_opportunity_stage_changed"
                    options={TRACK_STATUSES.map((s) => ({ value: s, label: TRACK_LABEL[s as TrackStatus] }))}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {uc && (
        <section aria-label="Your plan" className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">Your plan</h2>
          <form action={saveNotesAction} className="space-y-3">
            <input type="hidden" name="seriesId" value={id} />
            <label className="block space-y-1"><span className="text-sm text-ink">What you want from it</span><textarea name="goals" rows={2} defaultValue={uc.goals ?? ''} className={field} /></label>
            <label className="block space-y-1"><span className="text-sm text-ink">Notes (only you see these)</span><textarea name="notes" rows={3} defaultValue={uc.notes ?? ''} className={field} /></label>
            <button type="submit" className={small}>Save plan</button>
          </form>
        </section>
      )}

      {canEdit && (
        <ShowMore page="conference_edit_details" label="Edit details" defaultOpen={!!read}>
          <form action={editEntryAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="seriesId" value={id} />
            <label className="space-y-1 sm:col-span-2"><span className="text-sm text-ink">Name</span><input name="name" defaultValue={series.name} className={field} /></label>
            <label className="space-y-1 sm:col-span-2"><span className="text-sm text-ink">Conference site</span><input name="url" defaultValue={series.url ?? ''} className={field} /></label>
            <label className="space-y-1"><span className="text-sm text-ink">Organizer</span><input name="organizer" defaultValue={series.organizer ?? ''} className={field} /></label>
            <label className="space-y-1"><span className="text-sm text-ink">Cost note</span><input name="costNote" defaultValue={series.costNote ?? ''} placeholder="Free, student rate…" className={field} /></label>
            <label className="space-y-1"><span className="text-sm text-ink">Starts</span><input name="startDate" type="date" defaultValue={series.startDate ? series.startDate.toISOString().slice(0, 10) : ''} className={field} /></label>
            <label className="space-y-1"><span className="text-sm text-ink">Ends</span><input name="endDate" type="date" defaultValue={series.endDate ? series.endDate.toISOString().slice(0, 10) : ''} className={field} /></label>
            <label className="space-y-1"><span className="text-sm text-ink">City</span><input name="city" defaultValue={series.city ?? ''} className={field} /></label>
            <label className="space-y-1"><span className="text-sm text-ink">State</span><input name="state" defaultValue={series.state ?? ''} maxLength={2} className={field} /></label>
            <label className="space-y-1"><span className="text-sm text-ink">Ticket from ($)</span><input name="costLow" inputMode="numeric" defaultValue={series.costLow ?? ''} className={field} /></label>
            <label className="space-y-1"><span className="text-sm text-ink">Ticket up to ($)</span><input name="costHigh" inputMode="numeric" defaultValue={series.costHigh ?? ''} className={field} /></label>
            <label className="space-y-1 sm:col-span-2"><span className="text-sm text-ink">How is it held?</span>
              <select name="format" defaultValue={series.format} className={field}><option value="IN_PERSON">In person</option><option value="VIRTUAL">Online</option><option value="HYBRID">Both</option></select>
            </label>
            <div className="sm:col-span-2"><button type="submit" className={small}>Save changes</button></div>
          </form>
        </ShowMore>
      )}

      {uc && (
        <ShowMore page="conference_detail_more" label="People you met and speaking history" defaultOpen={uc.status === 'ATTENDED' && contacts.length === 0}>
          <div className="space-y-8">
            <section id="people" className="space-y-3">
              <h2 className="font-display text-xl font-semibold text-ink">Who you met</h2>
              {contacts.length > 0 && <ul className="text-sm text-ink">{contacts.map((c) => <li key={c.id}>{c.name}{c.company ? `, ${c.company}` : ''}</li>)}</ul>}
              <form action={logPeopleAction} className="space-y-2">
                <input type="hidden" name="seriesId" value={id} />
                <label className="block space-y-1"><span className="text-sm text-ink">One person per line: name, company, title</span><textarea name="people" rows={3} className={field} placeholder="Dana Lee, Acme Health, VP People" /></label>
                <button type="submit" className={small}>Add to my Contact Book</button>
                <p className="text-xs text-muted-foreground">Why we ask: each person goes into your Contact Book, so they show up when it is time to follow up.</p>
              </form>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold text-ink">Speaking history</h2>
              {talks.length > 0 && (
                <ul className="space-y-1 text-sm text-ink">
                  {talks.map((t) => <li key={t.id}>{TALK_KIND_LABEL[t.kind as TalkKind]}: {t.title}{t.slidesUrl && <> · <a className="text-brand underline" href={t.slidesUrl} target="_blank" rel="noopener noreferrer">slides</a></>}{t.videoUrl && <> · <a className="text-brand underline" href={t.videoUrl} target="_blank" rel="noopener noreferrer">video</a></>}</li>)}
                </ul>
              )}
              <form action={addTalkAction} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="seriesId" value={id} /><input type="hidden" name="kind" value="TALK" /><input type="hidden" name="eventName" value={series.name} />
                <input name="title" required placeholder="Talk title" aria-label="Talk title" className={field} />
                <input name="topic" placeholder="Topic" aria-label="Topic" className={field} />
                <input name="deliveredOn" type="date" aria-label="Date given" className={field} />
                <input name="slidesUrl" placeholder="Link to slides" aria-label="Link to slides" className={field} />
                <input name="videoUrl" placeholder="Link to video" aria-label="Link to video" className={field} />
                <button type="submit" className={small}>Add a talk</button>
              </form>
            </section>
          </div>
        </ShowMore>
      )}
      <p className="text-sm"><Link href="/dashboard/conferences" className="text-brand underline underline-offset-4">Back to your conferences</Link>{' · '}<a className="text-brand underline underline-offset-4" href={`/dashboard/conferences/calendar?id=${id}`}>Add dates to my calendar</a></p>
    </div>
  )
}
