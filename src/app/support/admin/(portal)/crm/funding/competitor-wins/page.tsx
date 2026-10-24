import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { listCompetitorAwards } from '@/lib/bids/queries'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 30

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString('en-US')}`)

function Block({ entries }: { entries: [string, Awaited<ReturnType<typeof listCompetitorAwards>>][] }) {
  return (
    <div className="space-y-4">
      {entries.map(([name, awards]) => (
        <section key={name} className="rounded-lg border border-border">
          <h3 className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 text-sm font-semibold">
            <span>{name}</span>
            <span className="text-xs font-normal text-muted-foreground">{awards.length} award{awards.length === 1 ? '' : 's'} · {money(awards.reduce((s, a) => s + a.amount, 0))}</span>
          </h3>
          <ul className="divide-y divide-border">
            {awards.slice(0, 15).map((a) => (
              <li key={a.id} className="space-y-0.5 p-3 text-sm">
                <a href={a.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{(a.description ?? a.awardId ?? 'Award').slice(0, 140)}</a>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>{a.kind === 'GRANT' ? 'Grant' : 'Contract'}</span>
                  <span>From {[a.agency, a.subAgency].filter(Boolean).join(' / ') || 'unknown'}</span>
                  <span>{money(a.amount)}</span>
                  <span>{a.startDate ? `Started ${formatDate(a.startDate)}` : 'No start date'}</span>
                  {a.recipientName.toLowerCase() !== name.toLowerCase() && <span>Filed as {a.recipientName}</span>}
                </div>
              </li>
            ))}
          </ul>
          {awards.length > 15 && <p className="px-3 pb-2 text-xs text-muted-foreground">{awards.length - 15} smaller awards not shown.</p>}
        </section>
      ))}
    </div>
  )
}

/** Federal contracts and grants won by competitors (USAspending.gov), grouped per competitor. */
export default async function CompetitorWinsPage() {
  await requireAdmin()
  let rows: Awaited<ReturnType<typeof listCompetitorAwards>> = []
  let missing = false
  try {
    rows = await listCompetitorAwards()
  } catch {
    missing = true
  }
  const group = (conf: string) => {
    const m = new Map<string, typeof rows>()
    for (const r of rows.filter((x) => x.confidence === conf)) m.set(r.competitorName, [...(m.get(r.competitorName) ?? []), r])
    return [...m.entries()].sort((a, b) => b[1].reduce((s, x) => s + x.amount, 0) - a[1].reduce((s, x) => s + x.amount, 0))
  }
  const exact = group('EXACT')
  const review = group('REVIEW')

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs"><Link href="/support/admin/crm/funding" className="text-muted-foreground hover:underline">← Open funding</Link></p>
        <h1 className="text-2xl font-semibold">Competitor federal wins</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Federal contracts and grants (last five years, USAspending.gov) won by the outplacement, reemployment, career-services and workforce-technology
          companies in Vision → Competitors, plus known WIOA operators. Prime awards only; subcontracts and state-level contracts do not appear here.
        </p>
      </header>
      {missing ? (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">The bid tables are not applied yet. Run <code>prisma/manual/bid-finder.sql</code>.</p>
      ) : (
        <>
          {exact.length === 0 ? <p className="text-sm text-muted-foreground">No wins found yet. The first pass fills this in.</p> : <Block entries={exact} />}
          {review.length > 0 && (
            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Name looks similar — confirm before relying on it ({review.length} competitors)</summary>
              <p className="my-2 text-xs text-muted-foreground">One-word names (“Pivot”) or a parent name with a suffix (“MAXIMUS US SERVICES”) could be a different company.</p>
              <Block entries={review} />
            </details>
          )}
        </>
      )}
    </div>
  )
}
