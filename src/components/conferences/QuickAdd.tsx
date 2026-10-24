'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { confirmConferenceAction, previewConferenceAction, type PreviewState } from '@/app/dashboard/conferences/actions'
import { ChoiceButtons } from '@/components/candidate/ChoiceButtons'
import { Chip } from '@/components/candidate/ui'
import { OPPORTUNITY_LABEL, type OpportunityType } from '@/lib/conferences/constants'
import { posthog } from '@/lib/posthog/client'

const btn = 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-70'
const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-ink'

function Submit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className={btn} style={pending ? { cursor: 'wait' } : undefined}>{pending ? busy : idle}</button>
}

const MANUAL_WHY = {
  deep_link: 'That site does not allow us to read its pages, so we keep your link and you fill in what you know.',
  fetch_failed: 'We could not read that page. Fill in what you know and add it anyway.',
  daily_limit: 'You have added a lot of links today, so we skipped reading this one. Fill in what you know and add it anyway.',
} as const

export function QuickAdd({ initialLink = '' }: { initialLink?: string }) {
  const [state, run] = useActionState<PreviewState, FormData>(
    async (prev, fd) => { posthog?.capture('conference_quick_add_submitted', { source: initialLink ? 'share' : 'paste' }); return previewConferenceAction(prev, fd) },
    { preview: null, error: null, url: initialLink },
  )
  const p = state.preview
  return (
    <div className="space-y-6">
      <form action={run} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="text-sm font-medium text-ink">Paste a conference link</span>
          <input name="link" type="text" inputMode="url" defaultValue={state.url} placeholder="https://" className={field} autoComplete="off" required />
        </label>
        <Submit idle="Read the page" busy="Reading the page…" />
      </form>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {p?.status === 'exists' && (
        <p className="rounded-2xl bg-muted p-5 text-base text-ink" role="status">
          {p.name} is already in our list, so we added it to your conferences.{' '}
          <Link href={`/dashboard/conferences/${p.seriesId}`} className="font-medium text-brand underline underline-offset-4">Open it</Link>
        </p>
      )}
      {p?.status === 'card' && <QuickAddCardForm key={p.card.urlKey} card={p.card} fromCache={p.fromCache} />}
    </div>
  )
}

export function QuickAddCardForm({ card, fromCache }: { card: Extract<NonNullable<PreviewState['preview']>, { status: 'card' }>['card']; fromCache: boolean }) {
  return (
    <form action={confirmConferenceAction} className="space-y-4 rounded-2xl border border-border p-5" onSubmit={() => posthog?.capture('conference_quick_add_confirm_clicked', { manual: card.manual, missing: card.missing.length, fromCache })}>
      <p className="font-semibold text-ink">{card.manual ? 'Add what you know' : 'Here is what we found. Fix anything that is off.'}</p>
      {card.manual && <p className="text-sm text-muted-foreground">{MANUAL_WHY[card.manual]}</p>}
      {!card.manual && card.missing.length > 0 && <p className="text-sm text-muted-foreground">We could not find the {card.missing.join(', ')}. Add it if you know it, or leave it blank.</p>}
      <input type="hidden" name="url" value={card.url} />
      <input type="hidden" name="opportunities" value={JSON.stringify(card.opportunities)} />
      <input type="hidden" name="country" value={card.country ?? ''} />
      {card.industries.map((v) => <input key={v} type="hidden" name="industries" value={v} />)}
      {card.functions.map((v) => <input key={v} type="hidden" name="functions" value={v} />)}
      {card.seniorities.map((v) => <input key={v} type="hidden" name="seniorities" value={v} />)}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2"><span className="text-sm text-ink">Name</span><input name="name" defaultValue={card.name ?? ''} className={field} /></label>
        <label className="space-y-1"><span className="text-sm text-ink">Organizer</span><input name="organizer" defaultValue={card.organizer ?? ''} className={field} /></label>
        <label className="space-y-1"><span className="text-sm text-ink">Cost note</span><input name="costNote" defaultValue={card.costNote ?? ''} placeholder="Free, from $495, student rate…" className={field} /></label>
        <label className="space-y-1"><span className="text-sm text-ink">Starts</span><input name="startDate" type="date" defaultValue={card.startDate ?? ''} className={field} /></label>
        <label className="space-y-1"><span className="text-sm text-ink">Ends</span><input name="endDate" type="date" defaultValue={card.endDate ?? ''} className={field} /></label>
        <label className="space-y-1"><span className="text-sm text-ink">City</span><input name="city" defaultValue={card.city ?? ''} className={field} /></label>
        <label className="space-y-1"><span className="text-sm text-ink">State</span><input name="state" defaultValue={card.state ?? ''} maxLength={2} className={field} /></label>
        <label className="space-y-1"><span className="text-sm text-ink">Ticket from ($)</span><input name="costLow" inputMode="numeric" defaultValue={card.costLow ?? ''} className={field} /></label>
        <label className="space-y-1"><span className="text-sm text-ink">Ticket up to ($)</span><input name="costHigh" inputMode="numeric" defaultValue={card.costHigh ?? ''} className={field} /></label>
      </div>
      <ChoiceButtons name="format" label="How is it held?" defaultValue={card.format ?? 'IN_PERSON'} options={[{ value: 'IN_PERSON', label: 'In person' }, { value: 'VIRTUAL', label: 'Online' }, { value: 'HYBRID', label: 'Both' }]} />
      <input type="hidden" name="whyAttend" value={card.whyAttend ?? ''} />
      {(card.industries.length > 0 || card.functions.length > 0) && (
        <div className="flex flex-wrap gap-2">{[...card.industries, ...card.functions].slice(0, 8).map((t) => <Chip key={t}>{t}</Chip>)}</div>
      )}
      {card.opportunities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">Ways to take part we found</p>
          <ul className="space-y-1 text-sm text-ink">
            {card.opportunities.map((o) => <li key={o.type + o.title}>{OPPORTUNITY_LABEL[o.type as OpportunityType]}: {o.title}{o.deadline ? `, closes ${o.deadline}` : ''}</li>)}
          </ul>
        </div>
      )}
      <Submit idle="Add to my conferences" busy="Adding…" />
    </form>
  )
}
