import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { getEvent } from '@/lib/events/store'
import { ACCESS, ACCESS_LABEL, FORMATS, JOURNEYS, JOURNEY_LABEL, PROGRAM_FORMATS, PROGRAM_LABEL, FORMAT_LABEL, KINDS, KIND_LABEL, SENIORITIES, SENIORITY_LABEL, SPEAKING, SPEAKING_LABEL } from '@/lib/events/types'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { INDUSTRIES, TAXONOMY } from '@/lib/events/taxonomy'
import { deleteEvent, saveEvent } from '../actions'

const field = 'w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand'
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1 block text-xs font-medium text-muted-foreground">
      {children}
      {hint && <span className="font-normal"> · {hint}</span>}
    </span>
  )
}

function Checks({ name, options, selected, labels }: { name: string; options: readonly string[]; selected: string[]; labels?: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name={name} value={o} defaultChecked={selected.includes(o)} />
          {labels?.[o] ?? o}
        </label>
      ))}
    </div>
  )
}

export default async function EventEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireAdmin()
  const { id } = await params
  const { saved, error } = await searchParams
  const e = id === 'new' ? null : await getEvent(id)
  if (id !== 'new' && !e) notFound()

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/support/admin/crm/events" className="text-sm text-muted-foreground hover:underline">All events</Link>
      <h1 className="text-2xl font-semibold">{e ? e.name : 'Add an event'}</h1>
      {saved && <p className="rounded-md border border-border bg-muted/40 p-2 text-sm">Saved.</p>}
      {error === 'name' && <p className="rounded-md border border-destructive p-2 text-sm">Give the event a name.</p>}
      {error === 'url' && <p className="rounded-md border border-destructive p-2 text-sm">A published event needs its link (starting https://). Nothing was saved.</p>}
      {error === 'confirm' && <p className="rounded-md border border-destructive p-2 text-sm">Tick the box to confirm the delete.</p>}

      <form action={saveEvent} className="space-y-5">
        <input type="hidden" name="id" value={e?.id ?? 'new'} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label><Label>Name</Label><input name="name" defaultValue={e?.name} required className={field} /></label>
          <label><Label>Organizer</Label><input name="organizer" defaultValue={e?.organizer ?? ''} className={field} /></label>
          <label className="sm:col-span-2"><Label hint="the event's own site">Event link</Label><input name="url" defaultValue={e?.url ?? ''} placeholder="https://" className={field} /></label>
          <label><Label>Kind</Label><select name="kind" defaultValue={e?.kind ?? 'CONFERENCE'} className={field}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
          <label><Label>Format</Label><select name="format" defaultValue={e?.format ?? 'IN_PERSON'} className={field}>{FORMATS.map((k) => <option key={k} value={k}>{FORMAT_LABEL[k]}</option>)}</select></label>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">When and where</legend>
          <div className="grid gap-3 sm:grid-cols-4">
            <label><Label>Starts</Label><input type="date" name="startDate" defaultValue={iso(e?.startDate ?? null)} className={field} /></label>
            <label><Label>Ends</Label><input type="date" name="endDate" defaultValue={iso(e?.endDate ?? null)} className={field} /></label>
            <label><Label hint="when no dates yet">Usual month</Label><input name="typicalMonth" defaultValue={e?.typicalMonth ?? ''} placeholder="March" className={field} /></label>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="datesConfirmed" defaultChecked={e?.datesConfirmed} />Dates confirmed on the event site</label>
            <label><Label>City</Label><input name="city" defaultValue={e?.city ?? ''} className={field} /></label>
            <label><Label>State</Label><input name="state" maxLength={2} defaultValue={e?.state ?? ''} className={field} /></label>
            <label><Label>Country</Label><input name="country" defaultValue={e?.country ?? 'US'} className={field} /></label>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Who it is for (leave a group empty for everyone)</legend>
          <div><Label>Functions</Label><Checks name="functions" options={PRIMARY_FUNCTION_OPTIONS} selected={e?.functions ?? []} /></div>
          <div><Label hint="leave empty for any journey">Journeys</Label><Checks name="journeys" options={JOURNEYS} selected={e?.journeys ?? []} labels={JOURNEY_LABEL} /></div>
          <div><Label>Seniority</Label><Checks name="seniorities" options={SENIORITIES} selected={e?.seniorities ?? []} labels={SENIORITY_LABEL} /></div>
          <div><Label>Industries</Label><Checks name="industries" options={INDUSTRY_BUCKET_NAMES} selected={e?.industries ?? []} /></div>
          <div className="space-y-2">
            <Label hint="sub-industries and communities, grouped by industry">Segments</Label>
            {INDUSTRIES.map((ind) => (
              <details key={ind} open={(e?.industries ?? []).includes(ind) || Object.keys(TAXONOMY[ind]).some((s) => (e?.segments ?? []).includes(s))}>
                <summary className="cursor-pointer text-sm font-medium">{ind}</summary>
                <div className="pt-1.5 pl-3"><Checks name="segments" options={Object.keys(TAXONOMY[ind])} selected={e?.segments ?? []} /></div>
              </details>
            ))}
          </div>
          <label className="block"><Label hint="comma separated, e.g. school principal, assistant principal">Specific jobs this event is for</Label><input name="roles" defaultValue={(e?.roles ?? []).join(', ')} className={field} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><Label hint="1 flagship, 2 major, 3 niche">Importance</Label><select name="importance" defaultValue={e?.importance ?? 2} className={field}><option value="1">1 · Flagship</option><option value="2">2 · Major</option><option value="3">3 · Niche</option></select></label>
            <label><Label hint="one line on the networking value">Why attend</Label><input name="whyAttend" defaultValue={e?.whyAttend ?? ''} className={field} /></label>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Cost and getting in</legend>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="sm:col-span-2"><Label>Access</Label><select name="access" defaultValue={e?.access ?? 'PAID'} className={field}>{ACCESS.map((a) => <option key={a} value={a}>{ACCESS_LABEL[a]}</option>)}</select></label>
            <label><Label hint="USD">Lowest price</Label><input name="costLow" inputMode="numeric" defaultValue={e?.costLow ?? ''} className={field} /></label>
            <label><Label hint="USD">Highest price</Label><input name="costHigh" inputMode="numeric" defaultValue={e?.costHigh ?? ''} className={field} /></label>
            <label className="sm:col-span-4"><Label hint="what the price includes, early-bird, member rate">Cost note</Label><input name="costNote" defaultValue={e?.costNote ?? ''} className={field} /></label>
            <label className="sm:col-span-4"><Label hint="volunteer, scholarship, expo-only pass, student rate, press pass">Cheaper ways in</Label><input name="cheaperWays" defaultValue={e?.cheaperWays ?? ''} className={field} /></label>
            <label className="sm:col-span-3"><Label hint="for invitation or apply-to-attend">Application link</Label><input name="applyUrl" defaultValue={e?.applyUrl ?? ''} placeholder="https://" className={field} /></label>
            <label><Label>Apply by</Label><input type="date" name="applyDeadline" defaultValue={iso(e?.applyDeadline ?? null)} className={field} /></label>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Speaking</legend>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-4"><Label hint="sessions imply a way onto the stage">Program has</Label><Checks name="programFormats" options={PROGRAM_FORMATS} selected={e?.programFormats ?? []} labels={PROGRAM_LABEL} /></div>
            <label className="sm:col-span-2"><Label>Path</Label><select name="speaking" defaultValue={e?.speaking ?? 'UNKNOWN'} className={field}>{SPEAKING.map((a) => <option key={a} value={a}>{SPEAKING_LABEL[a]}</option>)}</select></label>
            <label className="sm:col-span-2"><Label>Submit by</Label><input type="date" name="speakingDeadline" defaultValue={iso(e?.speakingDeadline ?? null)} className={field} /></label>
            <label className="sm:col-span-4"><Label>Speaker page link</Label><input name="speakingUrl" defaultValue={e?.speakingUrl ?? ''} placeholder="https://" className={field} /></label>
            <label className="sm:col-span-4"><Label hint="who is picked, how, what helps">Speaking note</Label><input name="speakingNote" defaultValue={e?.speakingNote ?? ''} className={field} /></label>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Control</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" defaultChecked={e?.verified} />Verified against the event&apos;s own site{e?.checkedAt ? ` (last ${e.checkedAt.toISOString().slice(0, 10)})` : ''}</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={e?.published} />Show to candidates (needs the event link)</label>
          <label className="block"><Label>Internal note (never shown to candidates)</Label><textarea name="adminNote" defaultValue={e?.adminNote ?? ''} rows={2} className={field} /></label>
        </fieldset>

        <button className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">Save event</button>
      </form>

      {e && (
        <form action={deleteEvent} className="flex items-center gap-3 border-t border-border pt-4 text-sm">
          <input type="hidden" name="id" value={e.id} />
          <label className="flex items-center gap-2"><input type="checkbox" name="confirm" />Yes, delete this event and everyone&apos;s saves of it</label>
          <button className="rounded-md border border-destructive px-3 py-1.5 text-destructive hover:bg-destructive/10">Delete event</button>
        </form>
      )}
    </div>
  )
}
