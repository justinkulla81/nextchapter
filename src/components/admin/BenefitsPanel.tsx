import { CATEGORY_LABELS, type BenefitProgramRow } from '@/lib/benefits/types'

const STATUS: Record<string, string> = { OPEN: 'Open', ROLLING: 'Rolling', CLOSED: 'Closed', UNKNOWN: 'Unknown' }

function Row({ r }: { r: BenefitProgramRow }) {
  return (
    <li className="space-y-1 p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{r.name}</a> : <span className="font-medium">{r.name}</span>}
        {r.employer && <span className="text-xs text-muted-foreground">{r.employer}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="rounded border border-border px-1.5 py-0.5">{CATEGORY_LABELS[r.category] ?? r.category}</span>
        {(r.city || r.locality) && <span>{[r.city ?? r.locality, r.state].filter(Boolean).join(', ')}</span>}
        <span className="rounded border border-border px-1.5 py-0.5">{STATUS[r.status] ?? r.status}</span>
        <span className={r.verified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{r.verified ? 'Verified' : 'Unverified: check before using'}</span>
        {r.amount && <span>{r.amount}</span>}
      </div>
    </li>
  )
}

/** Programs tied to one place or one employer, for a geography or company page. Renders nothing when empty. */
export function BenefitsPanel({ title, note, groups }: { title: string; note?: string; groups: { label: string; rows: BenefitProgramRow[] }[] }) {
  const shown = groups.filter((g) => g.rows.length > 0)
  if (shown.length === 0) return null
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      <div className="space-y-3">
        {shown.map((g) => (
          <div key={g.label}>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{g.label}</p>
            <ul className="divide-y divide-border rounded-lg border border-border">{g.rows.slice(0, 12).map((r) => <Row key={r.id} r={r} />)}</ul>
          </div>
        ))}
      </div>
    </section>
  )
}
