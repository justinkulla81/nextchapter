import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { buildFromParams, type Params } from '@/lib/pitch/request'
import { CUSTOMER_LABELS, CUSTOMER_TYPES } from '@/lib/pitch/types'
import { NEXTCHAPTER_COLORS } from '@/lib/pitch/brand'

export const maxDuration = 60
const BASE = '/support/admin/crm/pitch'
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function PitchBuilderPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin()
  const sp = await searchParams
  const type = one(sp.type)
  const colors = one(sp.colors) || 'nextchapter'
  const generic = one(sp.generic) === '1'
  const preview = one(sp.go) === '1'
  const areaQ = one(sp.areaq).trim()

  // Pick-a-county search: shows matches as links that fill the area field.
  const areaMatches = areaQ
    ? await prisma.geoArea.findMany({ where: { name: { contains: areaQ, mode: 'insensitive' } }, orderBy: [{ level: 'desc' }, { population: { sort: 'desc', nulls: 'last' } }], take: 8, select: { id: true, name: true, state: true, level: true } }).catch(() => [])
    : []
  const built = preview ? await buildFromParams(sp) : null
  const keep = (over: Record<string, string>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...sp, ...over })) for (const x of Array.isArray(v) ? v : [v]) if (x) p.append(k, x)
    return p.toString()
  }
  const dl = (format: 'pptx' | 'pdf') => `${BASE}/download?${keep({ format })}`
  const picked = new Set(Array.isArray(sp.ppl) ? sp.ppl : sp.ppl ? [sp.ppl] : [])
  const input = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand'

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pitch builder</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Builds a deck for one customer type from its pitch rules, with that area&apos;s numbers up front and the detail in an appendix. Download it as PowerPoint to edit in Google Slides, or as a PDF. Nothing is sent to anyone.
          </p>
        </div>
        <Link href="/support/admin/crm/pitch-rules" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Edit pitch rules</Link>
      </header>

      <form method="get" action={BASE} className="space-y-6">
        <input type="hidden" name="go" value="1" />
        {sp.lead && <input type="hidden" name="lead" value={one(sp.lead)} />}
        {sp.area && <input type="hidden" name="area" value={one(sp.area)} />}

        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">1. Who is it for</legend>
          <label className="space-y-1 text-sm">Customer type
            <select name="type" defaultValue={type} className={input} required>
              <option value="">Choose a type…</option>
              {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{CUSTOMER_LABELS[t]}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">Organization name (on the cover)
            <input name="org" defaultValue={one(sp.org) || built?.lead?.name || ''} className={input} placeholder="Louisville Economic Development Alliance" />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="generic" value="1" defaultChecked={generic} />
            Keep it generic: national numbers only, no local data, no names on the team slide unless you tick them below
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">2. Which area&apos;s data</legend>
          <p className="text-sm text-muted-foreground">
            Current area: <strong>{one(sp.area) || built?.lead ? (one(sp.area) || 'from the lead') : 'none chosen'}</strong>. Search a county or state to change it.
          </p>
          <div className="flex gap-2">
            <input name="areaq" defaultValue={areaQ} placeholder="Search a county or state, then click a match" className={input} />
          </div>
          {areaMatches.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm">
              {areaMatches.map((a) => (
                <li key={a.id}><Link href={`${BASE}?${keep({ area: a.id, areaq: '' })}`} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted">{a.level === 'STATE' ? a.name : `${a.name}, ${a.state}`}</Link></li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">3. Logo and colors</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colors">
            {[['nextchapter', 'NextChapter colors'], ['logo', 'Match their logo'], ['custom', 'Choose colors']].map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:checked]:font-semibold`}>
                <input type="radio" name="colors" value={v} defaultChecked={colors === v} className="sr-only" />{l}
              </label>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">Their website (we fetch a logo icon from it)
              <input name="website" defaultValue={one(sp.website)} className={input} placeholder="https://louisvillealliance.org" />
            </label>
            <label className="space-y-1 text-sm">Or a direct link to their logo (https, PNG, JPG, SVG)
              <input name="logoUrl" defaultValue={one(sp.logoUrl)} className={input} placeholder="https://…/logo.png" />
            </label>
            <label className="flex items-center gap-3 text-sm">Main color
              <input type="color" name="primary" defaultValue={one(sp.primary) || NEXTCHAPTER_COLORS.primary} aria-label="Main color" />
              <span className="text-muted-foreground">used when &quot;Choose colors&quot; is selected</span>
            </label>
            <label className="flex items-center gap-3 text-sm">Accent color
              <input type="color" name="accent" defaultValue={one(sp.accent) || NEXTCHAPTER_COLORS.accent} aria-label="Accent color" />
            </label>
          </div>
        </fieldset>

        {built && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">4. Who goes on the team slide (leave all unticked for none)</legend>
            {built.options.map((o) => (
              <label key={o.key} className="flex items-center gap-2 text-sm"><input type="checkbox" name="ppl" value={o.key} defaultChecked={picked.has(o.key)} />{o.label}</label>
            ))}
            <label className="block space-y-1 pt-2 text-sm">Add anyone else (one per line: Name | Title | Organization)
              <textarea name="more" defaultValue={one(sp.more)} rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
            </label>
          </fieldset>
        )}

        <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">{built ? 'Update preview' : 'Preview the deck'}</button>
      </form>

      {preview && !built && <p className="rounded-md border border-dashed border-border p-4 text-sm">Pick a customer type to preview a deck.</p>}

      {built && (
        <section className="space-y-4 rounded-lg border border-border p-5" aria-labelledby="preview">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="preview" className="text-lg font-semibold">{built.deck.slides.length} slides{built.deck.generic ? ' (generic)' : ''}{built.edited ? ', using your edited rules' : ', using default rules'}</h2>
            <div className="flex gap-2">
              <a href={dl('pptx')} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">Download PowerPoint (opens in Google Slides)</a>
              <a href={dl('pdf')} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Download PDF</a>
            </div>
          </div>
          {built.brandNote && <p className="text-sm text-muted-foreground">{built.brandNote}</p>}
          {built.deck.warnings.length > 0 && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Before you send this</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{built.deck.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          <ol className="grid gap-x-8 gap-y-1 text-sm md:grid-cols-2">
            {built.deck.slides.map((s, i) => (
              <li key={s.id} className="flex gap-2"><span className="w-6 text-right tabular-nums text-muted-foreground">{i + 1}</span><span className={s.appendix ? 'text-muted-foreground' : ''}>{s.title}</span></li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">To edit in Google Slides: open Google Drive, upload the .pptx, then open it with Google Slides.</p>
        </section>
      )}
    </div>
  )
}
