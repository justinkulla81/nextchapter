import { SubmitButton } from '@/components/ui/submit-button'
import { upsertCompetitor } from '@/app/support/admin/(portal)/vision/actions'
import { COMPETITOR_AREAS, RELATIONSHIPS, STATUSES, CATEGORIES, type NamedEntry, type WinEntry } from '@/lib/vision/competitor-areas'

export interface CompetitorFormValues {
  id?: string
  name?: string; url?: string | null; segment?: string | null; positioning?: string | null; relationship?: string
  areas?: string[]; keyFeatures?: string[]; customers?: NamedEntry[] | null; wins?: WinEntry[] | null
  weWin?: string[]; theyWin?: string[]; weNeed?: string[]
  pricingNote?: string | null; foundedYear?: number | null; hq?: string | null; lastRound?: string | null; investors?: string | null
  fundingRaisedUsd?: number | null; headcount?: number | null; revenueNote?: string | null; userCountNote?: string | null
  revenueUsd?: number | null; monthlyVisits?: number | null; trafficNote?: string | null
  sourceUrl?: string | null; notes?: string | null
  status?: string; statusNote?: string | null; lessons?: string[]; partnerIdea?: string | null; category?: string | null
}

const input = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm'
const area = 'w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm'
const Field = ({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) => (
  <label className={`text-sm ${wide ? 'sm:col-span-3' : ''}`}>
    <span className="mb-1 block font-medium">{label}</span>
    {children}
    {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
  </label>
)

/** The full card, as a form. Used to add by hand and to edit; a saved card counts as reviewed. */
export function CompetitorForm({ v = {}, submitLabel }: { v?: CompetitorFormValues; submitLabel: string }) {
  const customers = (v.customers ?? []).map((c) => [c.name, c.note, c.url].filter(Boolean).join(' | ')).join('\n')
  const wins = (v.wins ?? []).map((w) => [w.what, w.buyer, w.amount, w.year, w.url].map((x) => x ?? '').join(' | ').replace(/( \| )+$/, '')).join('\n')
  return (
    <form action={upsertCompetitor} className="grid gap-3 sm:grid-cols-3">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <Field label="Name"><input name="name" required defaultValue={v.name ?? ''} className={input} /></Field>
      <Field label="Website"><input name="url" defaultValue={v.url ?? ''} placeholder="example.com" className={input} /></Field>
      <Field label="Segment"><input name="segment" defaultValue={v.segment ?? ''} placeholder="Outplacement" className={input} /></Field>

      <fieldset className="sm:col-span-3">
        <legend className="mb-1 text-sm font-medium">How they relate to us</legend>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIPS.map((r) => (
            <label key={r.key} className="cursor-pointer rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10" title={r.hint}>
              <input type="radio" name="relationship" value={r.key} defaultChecked={(v.relationship ?? 'DIRECT') === r.key} className="mr-1.5" />{r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="sm:col-span-3">
        <legend className="mb-1 text-sm font-medium">Where they compete with us</legend>
        <div className="flex flex-wrap gap-2">
          {COMPETITOR_AREAS.map((a) => (
            <label key={a.key} className="cursor-pointer rounded-full border border-input px-3 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="checkbox" name="areas" value={a.key} defaultChecked={v.areas?.includes(a.key)} className="mr-1.5" />{a.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="sm:col-span-3">
        <legend className="mb-1 text-sm font-medium">Status</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((x) => (
            <label key={x.key} className="cursor-pointer rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="radio" name="status" value={x.key} defaultChecked={(v.status ?? 'ACTIVE') === x.key} className="mr-1.5" />{x.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="What happened (if not operating)" hint="Who bought them, or when and why they stopped." wide><input name="statusNote" defaultValue={v.statusNote ?? ''} className={input} /></Field>
      <Field label="Market">
        <select name="category" defaultValue={v.category ?? ''} className={input}>
          <option value="">Not set</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="How we could partner" wide><input name="partnerIdea" defaultValue={v.partnerIdea ?? ''} placeholder="Referral, integration, data, channel…" className={input} /></Field>
      <Field label="What we can learn from them" hint="One per line." wide><textarea name="lessons" rows={3} defaultValue={(v.lessons ?? []).join('\n')} className={area} /></Field>

      <Field label="What they sell and to whom" wide><textarea name="positioning" rows={2} defaultValue={v.positioning ?? ''} className={area} /></Field>
      <Field label="Key features" hint="One per line." wide><textarea name="keyFeatures" rows={4} defaultValue={(v.keyFeatures ?? []).join('\n')} className={area} /></Field>

      <Field label="Funding raised (USD)"><input name="fundingRaisedUsd" defaultValue={v.fundingRaisedUsd ?? ''} placeholder="24M" className={input} /></Field>
      <Field label="Last round"><input name="lastRound" defaultValue={v.lastRound ?? ''} placeholder="$24M Series B, 2025" className={input} /></Field>
      <Field label="Investors"><input name="investors" defaultValue={v.investors ?? ''} className={input} /></Field>
      <Field label="Revenue"><input name="revenueNote" defaultValue={v.revenueNote ?? ''} placeholder="~$20M ARR (reported)" className={input} /></Field>
      <Field label="Revenue a year (USD, for sorting)" hint="One number, e.g. 25M. The note above says if it is an estimate."><input name="revenueUsd" defaultValue={v.revenueUsd ?? ''} placeholder="25M" className={input} /></Field>
      <Field label="Website visits a month"><input name="monthlyVisits" defaultValue={v.monthlyVisits ?? ''} placeholder="1.2M" className={input} /></Field>
      <Field label="Where the visits figure came from"><input name="trafficNote" defaultValue={v.trafficNote ?? ''} placeholder="Similarweb, Sep 2026 (estimate)" className={input} /></Field>
      <Field label="Employees"><input name="headcount" inputMode="numeric" defaultValue={v.headcount ?? ''} className={input} /></Field>
      <Field label="Users or customers claimed"><input name="userCountNote" defaultValue={v.userCountNote ?? ''} className={input} /></Field>
      <Field label="Founded"><input name="foundedYear" inputMode="numeric" defaultValue={v.foundedYear ?? ''} className={input} /></Field>
      <Field label="Headquarters"><input name="hq" defaultValue={v.hq ?? ''} className={input} /></Field>
      <Field label="Pricing"><input name="pricingNote" defaultValue={v.pricingNote ?? ''} className={input} /></Field>
      <Field label="Where those numbers came from" wide><input name="sourceUrl" defaultValue={v.sourceUrl ?? ''} placeholder="https://…" className={input} /></Field>

      <Field label="Grants, funding and RFPs they have won" hint="One per line: what | buyer | amount | year | link" wide><textarea name="wins" rows={4} defaultValue={wins} className={area} /></Field>
      <Field label="Known customers" hint="One per line: name | note | link" wide><textarea name="customers" rows={4} defaultValue={customers} className={area} /></Field>

      <Field label="Where we win"><textarea name="weWin" rows={4} defaultValue={(v.weWin ?? []).join('\n')} className={area} /></Field>
      <Field label="Where they win"><textarea name="theyWin" rows={4} defaultValue={(v.theyWin ?? []).join('\n')} className={area} /></Field>
      <Field label="What we would need to compete"><textarea name="weNeed" rows={4} defaultValue={(v.weNeed ?? []).join('\n')} className={area} /></Field>
      <Field label="Notes" wide><textarea name="notes" rows={2} defaultValue={v.notes ?? ''} className={area} /></Field>

      <div className="sm:col-span-3">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        <span className="ml-2 text-xs text-muted-foreground">Saving marks the card as checked today.</span>
      </div>
    </form>
  )
}
