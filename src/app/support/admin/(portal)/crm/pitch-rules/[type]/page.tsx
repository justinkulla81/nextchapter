import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { loadRuleSet } from '@/lib/pitch/store'
import { CUSTOMER_TYPES, CUSTOMER_LABELS, type CustomerType, type SlideRule } from '@/lib/pitch/types'
import { saveRules, resetRules } from '../actions'

const EDITABLE_TEXT: SlideRule['kind'][] = ['bullets', 'stats', 'timeline', 'demo']
const TOKENS = ['org', 'area', 'state', 'board', 'unemp', 'unempChange', 'wcEst', 'bcEst', 'wcShare', 'income', 'layoffs12', 'layoffs90', 'colleges', 'dataCenters', 'natWc', 'natWcChange', 'natInfo', 'natInfoChange', 'natAsOf']
const field = 'w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand'

export default async function PitchRuleEditor({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin()
  const { type } = await params
  const { saved } = await searchParams
  if (!CUSTOMER_TYPES.includes(type as CustomerType)) notFound()
  const t = type as CustomerType
  const { rules, edited } = await loadRuleSet(t)
  const main = rules.slides.filter((s) => !s.appendix)
  const appx = rules.slides.filter((s) => s.appendix)

  const Row = ({ s }: { s: SlideRule }) => (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name={`on_${s.id}`} defaultChecked={s.enabled} /> Include &quot;{s.title.replace(/\{\{\w+\}\}/g, '…')}&quot;
        </label>
        <div className="flex gap-1">
          <button name="move" value={`${s.id}:up`} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted" aria-label={`Move ${s.id} up`}>Move up</button>
          <button name="move" value={`${s.id}:down`} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted" aria-label={`Move ${s.id} down`}>Move down</button>
        </div>
      </div>
      {s.why && <p className="mt-1 text-xs text-muted-foreground">{s.why}{s.needsGeo ? ' Left out of generic decks automatically.' : ''}</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs md:col-span-2">Title<input name={`title_${s.id}`} defaultValue={s.title} className={field} /></label>
        <label className="space-y-1 text-xs">Small label above the title<input name={`kicker_${s.id}`} defaultValue={s.kicker ?? ''} className={field} /></label>
      </div>
      {EDITABLE_TEXT.includes(s.kind) ? (
        <label className="mt-3 block space-y-1 text-xs">{s.kind === 'demo' ? 'Sample screen. One line each: FRAME|window title, KPI|label|value, HEAD|col|col|col, ROW|cell|cell|cell. Keep it obviously sample data.' : 'Text, one point per line'}
          <textarea name={`bullets_${s.id}`} defaultValue={s.bullets.join('\n')} rows={Math.max(3, s.bullets.length + 1)} className={field} />
        </label>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">The content of this slide comes from the data; you can reword the title and switch it on or off.</p>
      )}
    </li>
  )

  return (
    <div className="space-y-8">
      <header>
        <Link href="/support/admin/crm/pitch-rules" className="text-sm text-brand hover:underline">All pitch rules</Link>
        <h1 className="mt-1 text-2xl font-semibold">{CUSTOMER_LABELS[t]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{edited ? 'You have edited these rules.' : 'These are the default rules.'} This is an intro deck: no prices appear unless you fill in the optional price below.</p>
        {saved && <p role="status" className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{saved === 'reset' ? 'Reset to the default rules.' : saved === 'moved' ? 'Slide moved and rules saved.' : 'Saved. Decks built from now on use these rules.'}</p>}
      </header>

      <form action={saveRules} className="space-y-8">
        <input type="hidden" name="type" value={t} />
        <textarea name="order" defaultValue={rules.slides.map((s) => s.id).join('\n')} hidden readOnly />

        <section className="space-y-3" aria-labelledby="who">
          <h2 id="who" className="text-lg font-semibold">Audience and angle</h2>
          <label className="block space-y-1 text-sm">Who we pitch<input name="buyer" defaultValue={rules.buyer} className={field} /></label>
          <label className="block space-y-1 text-sm">Angle (the reason they should care)<textarea name="angle" defaultValue={rules.angle} rows={2} className={field} /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">Tone<input name="tone" defaultValue={rules.tone} className={field} /></label>
            <label className="space-y-1 text-sm">The ask<input name="ask" defaultValue={rules.ask} className={field} /></label>
          </div>
          <label className="block space-y-1 text-sm">Who we suggest putting on the team slide, one per line<textarea name="suggested" defaultValue={rules.suggestedPeople.join('\n')} rows={3} className={field} /></label>
        </section>

        <section className="space-y-3" aria-labelledby="packages">
          <h2 id="packages" className="text-lg font-semibold">Packages (no prices)</h2>
          <label className="block space-y-1 text-sm">One block per package, separated by a blank line. First line: Name | who it is for. Then one line per thing it includes.
            <textarea name="packages" defaultValue={rules.packages.map((x) => [`${x.name} | ${x.bestFor}`, ...x.includes].join('\n')).join('\n\n')} rows={Math.max(10, rules.packages.reduce((n, x) => n + x.includes.length + 2, 0))} className={field} />
          </label>
          <label className="block space-y-1 text-sm">Reminders shown as a warning on every deck of this type, one per line (for example, features to confirm are live)
            <textarea name="review_notes" defaultValue={rules.reviewNotes.join('\n')} rows={2} className={field} />
          </label>
        </section>

        <section className="space-y-3" aria-labelledby="offer">
          <h2 id="offer" className="text-lg font-semibold">The offer</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">Offer name<input name="offer_name" defaultValue={rules.offer.name} className={field} /></label>
            <label className="space-y-1 text-sm">Term<input name="offer_term" defaultValue={rules.offer.term} className={field} /></label>
            <label className="space-y-1 text-sm">Price (optional; leave blank for intro decks and none is shown)<input name="offer_price" defaultValue={rules.offer.price} className={field} /></label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">What they get, one per line<textarea name="offer_scope" defaultValue={rules.offer.scope.join('\n')} rows={4} className={field} /></label>
            <label className="space-y-1 text-sm">What we need from them, one per line<textarea name="offer_they" defaultValue={rules.offer.theyProvide.join('\n')} rows={4} className={field} /></label>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="main">
          <h2 id="main" className="text-lg font-semibold">Main deck ({main.filter((s) => s.enabled).length} of {main.length} slides on)</h2>
          <details className="rounded-md border border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Fill-in values you can use in any text</summary>
            <p className="mt-2 text-muted-foreground">Write them in double braces, for example {'{{area}}'} or {'{{wcEst}}'}. They fill from the area&apos;s data when a deck is built.</p>
            <p className="mt-1 flex flex-wrap gap-2">{TOKENS.map((k) => <code key={k} className="rounded bg-muted px-1.5 py-0.5 text-xs">{`{{${k}}}`}</code>)}</p>
          </details>
          <ol className="space-y-3">{main.map((s) => <Row key={s.id} s={s} />)}</ol>
        </section>

        <section className="space-y-3" aria-labelledby="appx">
          <h2 id="appx" className="text-lg font-semibold">Appendix ({appx.filter((s) => s.enabled).length} of {appx.length} slides on)</h2>
          <ol className="space-y-3">{appx.map((s) => <Row key={s.id} s={s} />)}</ol>
        </section>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-background py-3">
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">Save rules</button>
          <Link href={`/support/admin/crm/pitch?type=${t}`} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Build a pitch with these rules</Link>
        </div>
      </form>

      <form action={resetRules} className="border-t border-border pt-4">
        <input type="hidden" name="type" value={t} />
        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Reset to the default rules</button>
        <p className="mt-1 text-xs text-muted-foreground">Throws away every edit for this customer type.</p>
      </form>
    </div>
  )
}
