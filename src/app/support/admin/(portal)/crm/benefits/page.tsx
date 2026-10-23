import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { countByCategory, listPrograms, seedCatalogIfEmpty } from '@/lib/benefits/store'
import { CATEGORY_LABELS, CATEGORY_ORDER, type BenefitCategory } from '@/lib/benefits/types'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 30

const STATUS_LABELS: Record<string, string> = { OPEN: 'Open', ROLLING: 'Rolling', CLOSED: 'Closed', UNKNOWN: 'Unknown' }

/**
 * The benefits catalog: relocation incentives, retraining and tuition funds, federal programs,
 * free courses, AI and philanthropic funds, and help by profession, for every state. Pitch
 * decks pull verified, open rows from here. Unverified rows are leads to check, not facts.
 */
export default async function CrmBenefitsPage({ searchParams }: { searchParams: Promise<{ category?: string; state?: string; status?: string; q?: string; verified?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const category = CATEGORY_ORDER.find((c) => c === sp.category) as BenefitCategory | undefined
  const state = /^[A-Za-z]{2}$/.test(sp.state ?? '') ? sp.state!.toUpperCase() : undefined
  const status = ['OPEN', 'ROLLING', 'CLOSED', 'UNKNOWN'].includes(sp.status ?? '') ? sp.status : undefined
  const q = sp.q?.slice(0, 80)
  const verifiedOnly = sp.verified === '1'

  let rows: Awaited<ReturnType<typeof listPrograms>> = []
  let counts: Record<string, number> = {}
  let missing = false
  try {
    // First visit after the table is created: load the bundled catalog (no-op once it has rows).
    await seedCatalogIfEmpty()
    ;[rows, counts] = await Promise.all([listPrograms({ category, state, status, q, verifiedOnly, limit: 300 }), countByCategory()])
  } catch {
    missing = true
  }

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const m = { category, state, status, q, verified: verifiedOnly ? '1' : undefined, ...o }
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v)
    const s = p.toString()
    return `/support/admin/crm/benefits${s ? `?${s}` : ''}`
  }
  const chip = (active: boolean) => `rounded-md border px-2.5 py-1 text-xs ${active ? 'border-foreground bg-muted font-medium' : 'border-border hover:bg-muted'}`
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Benefits</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Money and help for laid-off professionals, every state and national: relocation incentives, retraining and tuition funds,
          federal programs, free courses, AI and philanthropic funds, and help by profession. Pitch decks use only the rows marked
          verified. Everything else is a lead to check against the program&apos;s own page.
        </p>
      </header>

      {missing ? (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          The BenefitProgram table is not applied yet. Run <code>prisma/manual/benefit-programs.sql</code>, then open this tab again; it fills itself from the bundled catalog.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href({ category: '' })} className={chip(!category)}>All ({total})</Link>
            {CATEGORY_ORDER.map((c) => (
              <Link key={c} href={href({ category: c })} className={chip(category === c)}>{CATEGORY_LABELS[c]} ({counts[c] ?? 0})</Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action="/support/admin/crm/benefits" className="flex items-center gap-2">
              {category && <input type="hidden" name="category" value={category} />}
              {status && <input type="hidden" name="status" value={status} />}
              {verifiedOnly && <input type="hidden" name="verified" value="1" />}
              <input name="q" defaultValue={q} placeholder="Search programs" className="w-48 rounded-md border border-border bg-background px-2 py-1 text-xs" />
              <input name="state" defaultValue={state} maxLength={2} placeholder="State (KY)" className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs" />
              <button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">Filter</button>
            </form>
            <Link href={href({ status: '' })} className={chip(!status)}>Any status</Link>
            {['OPEN', 'ROLLING', 'CLOSED'].map((s) => <Link key={s} href={href({ status: s })} className={chip(status === s)}>{STATUS_LABELS[s]}</Link>)}
            <Link href={href({ verified: verifiedOnly ? '' : '1' })} className={chip(verifiedOnly)}>Verified only</Link>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{total === 0 ? 'The catalog is empty. Load it with the import script.' : 'Nothing matches.'}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.map((r) => (
                <li key={r.id} className="space-y-1 p-3 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{r.name}</a> : <span className="font-medium">{r.name}</span>}
                    {r.provider && <span className="text-xs text-muted-foreground">{r.provider}</span>}
                    {r.employer && <span className="rounded border border-border px-1.5 py-0.5 text-xs">Employer: {r.employer}</span>}
                    {r.geoAreaId && <Link href={`/support/admin/crm/geographies/${r.geoAreaId}`} className="text-xs text-brand hover:underline">Area page</Link>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="rounded border border-border px-1.5 py-0.5">{CATEGORY_LABELS[r.category] ?? r.category}</span>
                    <span>{r.scope === 'NATIONAL' ? 'National' : [r.city ?? r.locality, r.state].filter(Boolean).join(', ')}</span>
                    <span className="rounded border border-border px-1.5 py-0.5">{STATUS_LABELS[r.status] ?? r.status}</span>
                    <span className={r.verified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                      {r.verified ? `Verified${r.checkedAt ? ` ${formatDate(r.checkedAt)}` : ''}` : 'Unverified: check before using'}
                    </span>
                    {r.amount && <span>{r.amount}</span>}
                  </div>
                  {r.eligibility && <p className="text-xs text-muted-foreground">{r.eligibility}</p>}
                  {r.statusNote && <p className="text-xs text-muted-foreground">{r.statusNote}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
