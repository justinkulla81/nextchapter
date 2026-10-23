import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatDate } from '@/lib/vision/labels'
import { COMPETITOR_AREAS, areaLabel, relationshipLabel } from '@/lib/vision/competitor-areas'
import { CAPABILITIES, capabilityCountsByArea } from '@/lib/vision/capabilities'
import {
  CELL_LABEL, CELL_STATUSES, MAX_COLUMNS, STALE_DAYS, catalogIn, defaultColumns, isStale, looksLikeMissingTable, parseColumnIds, summarize,
  type CellStatus,
} from '@/lib/vision/capability-matrix'
import { saveCapabilityCell, syncCapabilityCatalog } from './actions'

export const maxDuration = 30

/** The clock is read here, not in the component body, because react-hooks/purity forbids reading it during render. */
const nowDate = () => new Date()

type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(',') : v ?? '')

const OURS_STYLE: Record<string, string> = {
  BUILT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  PARTIAL: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  PLANNED: 'bg-muted text-muted-foreground',
}
const CELL_STYLE: Record<CellStatus, string> = {
  YES: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  PARTIAL: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  NO: 'bg-slate-500/15 text-slate-800 dark:text-slate-200',
  UNKNOWN: 'border border-dashed border-border text-muted-foreground',
}

interface CellRow {
  competitorId: string
  status: CellStatus
  note: string | null
  evidenceUrl: string | null
  checkedAt: Date | null
  checkedBy: string | null
  key: string
}

export default async function VisionCapabilitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin()
  const sp = await searchParams
  const area = COMPETITOR_AREAS.some((a) => a.key === one(sp.area)) ? one(sp.area) : 'job_search'
  const caps = catalogIn(area)
  const counts = capabilityCountsByArea()
  const now = nowDate()

  // Competitors that could be columns here: DIRECT and ADJACENT first. If nobody is tagged with this area yet, offer all of them.
  const everyone = await prisma.productCompetitor.findMany({
    where: { relationship: { in: ['DIRECT', 'ADJACENT', 'PARTNER', 'SUPPLIER'] } },
    select: { id: true, name: true, url: true, relationship: true, areas: true, status: true },
    orderBy: { name: 'asc' },
  }).catch(() => null)

  let state: 'ok' | 'missing' | 'error' = 'ok'
  let cells: CellRow[] = []
  try {
    const rows = await prisma.competitorCapability.findMany({
      where: { capability: { area } },
      select: { competitorId: true, status: true, note: true, evidenceUrl: true, checkedAt: true, checkedBy: true, capability: { select: { key: true } } },
    })
    cells = rows.map((r) => ({ competitorId: r.competitorId, status: r.status as CellStatus, note: r.note, evidenceUrl: r.evidenceUrl, checkedAt: r.checkedAt, checkedBy: r.checkedBy, key: r.capability.key }))
  } catch (e) {
    state = looksLikeMissingTable(e) ? 'missing' : 'error'
  }

  const base = new Map<string, Map<string, CellRow>>()
  for (const c of cells) {
    if (!base.has(c.competitorId)) base.set(c.competitorId, new Map())
    base.get(c.competitorId)!.set(c.key, c)
  }
  const filledIn = (id: string) => [...(base.get(id)?.values() ?? [])].filter((c) => c.status !== 'UNKNOWN').length

  const all = everyone ?? []
  const tagged = all.filter((c) => c.areas.includes(area))
  const pool = tagged.length > 0 ? tagged : all
  const candidates = pool.map((c) => ({ ...c, filled: filledIn(c.id) }))
  const knownIds = new Set(candidates.map((c) => c.id))
  const chosenIds = parseColumnIds(one(sp.cols), knownIds)
  const shown = chosenIds.length > 0
    ? chosenIds.map((id) => candidates.find((c) => c.id === id)!)
    : defaultColumns(candidates)
  const colsParam = chosenIds.join(',')

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ area, cols: colsParam, ...over })) if (v) p.set(k, v)
    return `/support/admin/vision/capabilities?${p.toString()}`
  }

  const cellOf = (competitorId: string, key: string): CellRow | undefined => base.get(competitorId)?.get(key)
  const summaries = new Map(shown.map((c) => [c.id, summarize(caps, new Map([...(base.get(c.id)?.entries() ?? [])].map(([k, v]) => [k, { status: v.status, checkedAt: v.checkedAt }])))]))
  const staleFilled = shown.reduce((n, c) => n + [...(base.get(c.id)?.values() ?? [])].filter((x) => x.status !== 'UNKNOWN' && isStale(x.checkedAt, now)).length, 0)
  const totalFilled = shown.reduce((n, c) => n + (summaries.get(c.id)?.filled ?? 0), 0)

  const edit = one(sp.edit)
  const [editCompetitorId, editKey] = edit.split('~')
  const editCompetitor = shown.find((c) => c.id === editCompetitorId) ?? candidates.find((c) => c.id === editCompetitorId)
  const editCap = caps.find((c) => c.key === editKey)
  const editCell = editCompetitor && editCap ? cellOf(editCompetitor.id, editCap.key) : undefined
  const draftStatus = one(sp.d_status)
  const d = {
    status: (CELL_STATUSES as readonly string[]).includes(draftStatus) ? draftStatus : editCell?.status ?? 'UNKNOWN',
    note: sp.d_note !== undefined ? one(sp.d_note) : editCell?.note ?? '',
    url: sp.d_url !== undefined ? one(sp.d_url) : editCell?.evidenceUrl ?? '',
    by: sp.d_by !== undefined ? one(sp.d_by) : editCell?.checkedBy ?? '',
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision" className="text-muted-foreground hover:underline">← Vision</Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link href="/support/admin/vision/competitors" className="text-muted-foreground hover:underline">Competitors</Link>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Capability matrix</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            What we can do, against what each competitor does, one area at a time. {CAPABILITIES.length} capabilities. A Yes, Partial or No needs a source link and the date it was checked; Unknown means nobody has looked.
          </p>
        </div>
        <a href={`/support/admin/vision/capabilities/export?area=${area}`} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Download this area as CSV</a>
      </header>

      {sp.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">{one(sp.error)}</p>}
      {sp.saved && <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">Saved. The cell now shows today&apos;s date.</p>}
      {sp.synced && <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">Catalog written to the database: {one(sp.synced)} capabilities.</p>}

      <section aria-label="Choose an area">
        <h2 className="text-sm font-semibold">Area</h2>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {COMPETITOR_AREAS.map((a) => {
            const on = a.key === area
            return (
              <li key={a.key}>
                <Link href={`/support/admin/vision/capabilities?area=${a.key}`} aria-current={on ? 'page' : undefined} className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted'}`}>
                  {a.label} <span className="text-muted-foreground">{counts[a.key] ?? 0}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {state === 'missing' && (
        <div role="alert" className="rounded-lg border border-orange/40 bg-orange/5 p-4 text-sm">
          <p className="font-medium">The capability tables are not in the database yet.</p>
          <p className="mt-1 text-muted-foreground">
            Our own column below still works. Competitor cells appear once <code>prisma/manual/2026-10-23-capability-matrix.sql</code> has been applied. Nothing can be saved until then.
          </p>
        </div>
      )}
      {state === 'error' && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm">
          <p className="font-medium">The competitor cells could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">The database did not answer. Our own capabilities are shown without competitor columns. <Link href={qs({})} className="underline">Try again</Link>.</p>
        </div>
      )}
      {everyone === null && state !== 'error' && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">The competitor list could not be loaded. <Link href={qs({})} className="underline">Try again</Link>.</p>
      )}

      <section className="space-y-3" aria-label="Competitors shown">
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Choose competitors <span className="font-normal text-muted-foreground">showing {shown.length} of up to {MAX_COLUMNS}{chosenIds.length === 0 ? ', picked by most cells filled' : ''}</span>
          </summary>
          <form method="get" className="mt-3 space-y-3">
            <input type="hidden" name="area" value={area} />
            {tagged.length === 0 && all.length > 0 && <p className="text-xs text-muted-foreground">No competitor is tagged with {areaLabel(area)} yet, so everyone is listed.</p>}
            <fieldset>
              <legend className="text-xs text-muted-foreground">Direct competitors first, then adjacent, partners and suppliers. Choose up to {MAX_COLUMNS}.</legend>
              <div className="mt-2 grid max-h-64 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {[...candidates].sort((a, b) => ['DIRECT', 'ADJACENT', 'PARTNER', 'SUPPLIER'].indexOf(a.relationship) - ['DIRECT', 'ADJACENT', 'PARTNER', 'SUPPLIER'].indexOf(b.relationship) || b.filled - a.filled || a.name.localeCompare(b.name)).map((c) => (
                  <label key={c.id} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="cols" value={c.id} defaultChecked={shown.some((s) => s.id === c.id)} className="mt-1" />
                    <span>{c.name} <span className="text-xs text-muted-foreground">{relationshipLabel(c.relationship)}{c.filled > 0 ? `, ${c.filled} filled` : ''}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <SubmitButton size="sm" pendingLabel="Updating the table…">Show these competitors</SubmitButton>
              <Link href={`/support/admin/vision/capabilities?area=${area}`} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Back to the default choice</Link>
            </div>
          </form>
        </details>
        {totalFilled > 0 && (
          <p className="text-xs text-muted-foreground">
            {totalFilled} cells answered here; {staleFilled} {staleFilled === 1 ? 'is' : 'are'} older than {STALE_DAYS} days or undated and marked stale.
          </p>
        )}
      </section>

      {caps.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No capabilities are listed for {areaLabel(area)} yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 align-bottom">
                <th scope="col" className="sticky left-0 z-10 min-w-56 bg-muted/50 px-3 py-2 text-left font-medium">Capability</th>
                <th scope="col" className="min-w-28 px-2 py-2 text-left font-medium">NextChapter</th>
                {shown.map((c) => {
                  const s = summaries.get(c.id)!
                  return (
                    <th key={c.id} scope="col" className="min-w-36 px-2 py-2 text-left font-normal">
                      <span className="block text-sm font-medium">{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">{c.name} ↗</a> : c.name}</span>
                      <span className="block text-muted-foreground">{relationshipLabel(c.relationship)}{c.status !== 'ACTIVE' ? ', gone' : ''}</span>
                      <span className="mt-1 block text-muted-foreground">{s.filled} of {s.total} filled</span>
                      <span className="block text-muted-foreground">{s.coveragePct === null ? 'no built capability to cover' : `${s.coveragePct}% of our built`}</span>
                      <span className="block text-muted-foreground">{s.filled === 0 ? 'nothing checked' : s.oldestCheckedAt ? `oldest ${formatDate(s.oldestCheckedAt)}` : 'undated'}{s.filled > 0 && s.anyUnchecked && s.oldestCheckedAt ? ', some undated' : ''}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {caps.map((cap) => (
                <tr key={cap.key} className="border-b border-border last:border-0 align-top">
                  <th scope="row" className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-normal">
                    <span className="block text-sm font-medium">{cap.name}</span>
                    <span className="block text-muted-foreground">{cap.description}</span>
                  </th>
                  <td className="px-2 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${OURS_STYLE[cap.ours]}`} title={`Evidence: ${cap.evidencePath}`}>{cap.ours === 'BUILT' ? 'Built' : cap.ours === 'PARTIAL' ? 'Partial' : 'Planned'}</span>
                  </td>
                  {shown.map((c) => {
                    const cell = cellOf(c.id, cap.key)
                    const status: CellStatus = cell?.status ?? 'UNKNOWN'
                    const stale = status !== 'UNKNOWN' && isStale(cell?.checkedAt, now)
                    const tip = status === 'UNKNOWN'
                      ? `${c.name}: not checked yet. Select to record it.`
                      : [`${c.name}: ${CELL_LABEL[status]}`, cell?.note, cell?.evidenceUrl ? `Source: ${cell.evidenceUrl}` : null, cell?.checkedAt ? `Checked ${formatDate(cell.checkedAt)}${cell.checkedBy ? ` by ${cell.checkedBy}` : ''}` : 'No check date', stale ? 'Stale: check again.' : null].filter(Boolean).join('\n')
                    return (
                      <td key={c.id} className="px-1.5 py-1.5">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`${qs({ edit: `${c.id}~${cap.key}` })}#editor`}
                            title={tip}
                            aria-label={`${c.name}, ${cap.name}: ${CELL_LABEL[status]}${stale ? ', stale' : ''}. Edit.`}
                            className={`inline-block rounded px-2 py-1 font-medium ${CELL_STYLE[status]} focus-visible:ring-2 focus-visible:ring-brand`}
                          >
                            {CELL_LABEL[status]}
                          </Link>
                          {cell?.evidenceUrl && status !== 'UNKNOWN' && (
                            <a href={cell.evidenceUrl} target="_blank" rel="noreferrer" aria-label={`Source for ${c.name}, ${cap.name}`} title={cell.evidenceUrl} className="text-muted-foreground hover:underline">source ↗</a>
                          )}
                        </div>
                        {status !== 'UNKNOWN' && (
                          <span className={`mt-0.5 block ${stale ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
                            {cell?.checkedAt ? formatDate(cell.checkedAt) : 'undated'}{stale ? ' · stale' : ''}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && (
            <p className="border-t border-border p-4 text-center text-sm text-muted-foreground">
              {all.length === 0 ? 'No competitors are tracked yet. Add some on the Competitors page.' : 'No competitors chosen. Use Choose competitors above.'}
            </p>
          )}
        </div>
      )}

      {editCompetitor && editCap && (
        <section id="editor" className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5">
          <h2 className="text-lg font-semibold">{editCompetitor.name}: {editCap.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{editCap.description}</p>
          <form action={saveCapabilityCell} className="mt-4 space-y-4">
            <input type="hidden" name="competitorId" value={editCompetitor.id} />
            <input type="hidden" name="capabilityKey" value={editCap.key} />
            <input type="hidden" name="area" value={area} />
            <input type="hidden" name="cols" value={colsParam} />
            <fieldset>
              <legend className="text-sm font-medium">Do they have it?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CELL_STATUSES.map((s) => (
                  <label key={s} className="cursor-pointer">
                    <input type="radio" name="status" value={s} defaultChecked={d.status === s} className="peer sr-only" />
                    <span className="block rounded-md border border-border px-4 py-2 text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{CELL_LABEL[s]}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Choose Unknown if you looked and could not tell. Yes, Partial and No need a source link.</p>
            </fieldset>
            <div>
              <label htmlFor="evidenceUrl" className="text-sm font-medium">Source link</label>
              <input id="evidenceUrl" name="evidenceUrl" type="url" defaultValue={d.url} placeholder="https://" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">The page that shows it. Must start with https://.</p>
            </div>
            <div>
              <label htmlFor="note" className="text-sm font-medium">Note</label>
              <textarea id="note" name="note" rows={2} defaultValue={d.note} maxLength={1000} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">What you saw, in plain words, such as which plan includes it.</p>
            </div>
            <div>
              <label htmlFor="checkedBy" className="text-sm font-medium">Checked by</label>
              <input id="checkedBy" name="checkedBy" defaultValue={d.by} placeholder="Your name or email" className="mt-1 h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">Today&apos;s date is recorded when you save.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton pendingLabel="Saving the cell…" className="h-11 px-5 text-base">Save this cell</SubmitButton>
              <Link href={qs({})} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Close without saving</Link>
              {editCell?.checkedAt && <span className="text-xs text-muted-foreground">Last checked {formatDate(editCell.checkedAt)}{editCell.checkedBy ? ` by ${editCell.checkedBy}` : ''}.</span>}
            </div>
          </form>
        </section>
      )}

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Database setup</summary>
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
          The rows on this page come from <code>src/lib/vision/capabilities.ts</code>. Saving a cell adds its row to the database on its own. This button writes all {CAPABILITIES.length} at once, which is only needed before research files are imported. Safe to repeat.
        </p>
        <form action={syncCapabilityCatalog} className="mt-2">
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="cols" value={colsParam} />
          <SubmitButton size="sm" variant="outline" pendingLabel="Writing the catalog…">Write the catalog to the database</SubmitButton>
        </form>
      </details>
    </div>
  )
}
