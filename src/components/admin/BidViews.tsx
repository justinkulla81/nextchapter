import Link from 'next/link'
import { formatDate } from '@/lib/crm/labels'
import { awardIsWorkforce, bidFitsUs } from '@/lib/bids/relevance'
import type { listCompetitorAwards, listOpenBoardBids } from '@/lib/bids/queries'

const NEW_HOURS = 24 * 8


function BidList({ rows, cutoff }: { rows: Awaited<ReturnType<typeof listOpenBoardBids>>; cutoff: number }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">None.</p>
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {rows.map((b) => (
            <li key={b.id} className="space-y-1 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <a href={b.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{b.title}</a>
                {b.firstSeenAt.getTime() >= cutoff && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">New</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <Link href={`/support/admin/crm/workforce-boards/${b.boardId}`} className="hover:underline">{b.boardName} ({b.state})</Link>
                {b.deadline ? <span>Due {formatDate(b.deadline)}</span> : <span>No deadline on the page</span>}
                <span>First seen {formatDate(b.firstSeenAt)}</span>
                <a href={b.pageUrl} target="_blank" rel="noreferrer" className="hover:underline">Board&apos;s procurement page</a>
              </div>
            </li>
          ))}
    </ul>
  )
}

export function BoardBidsView({ rows, missing }: { rows: Awaited<ReturnType<typeof listOpenBoardBids>>; missing: boolean }) {
  const cutoff = rows.length ? Math.max(...rows.map((r) => r.lastSeenAt.getTime())) - NEW_HOURS * 3_600_000 : 0

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs"><Link href="/support/admin/crm/funding" className="text-muted-foreground hover:underline">← Open funding</Link></p>
        <h1 className="text-2xl font-semibold">Workforce board bids</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Bids and RFPs read from each workforce board&apos;s own procurement page, about once a week. A board whose page lists nothing
          shows nothing. Deadlines are as written on the board&apos;s page; open the link to confirm before acting.
        </p>
      </header>

      {missing ? (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">The bid tables are not applied yet. Run <code>prisma/manual/bid-finder.sql</code>.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open board bids yet. The first weekly pass fills this in.</p>
      ) : (
        <>
          <BidList rows={rows.filter((b) => bidFitsUs(b.title))} cutoff={cutoff} />
          {rows.some((b) => !bidFitsUs(b.title)) && (
            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Other bids that do not look like our work ({rows.filter((b) => !bidFitsUs(b.title)).length})</summary>
              <div className="mt-3"><BidList rows={rows.filter((b) => !bidFitsUs(b.title))} cutoff={cutoff} /></div>
            </details>
          )}
        </>
      )}
    </div>
  )
}

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString('en-US')}`)

/** One line per competitor that has won something: how many awards and how much, biggest first. */
function WinnersTable({ entries }: { entries: [string, Awaited<ReturnType<typeof listCompetitorAwards>>][] }) {
  const rows = entries
    .map(([name, awards]) => ({ name, count: awards.length, total: awards.reduce((t, a) => t + a.amount, 0), workforce: awards.filter(awardIsWorkforce).reduce((t, a) => t + a.amount, 0), latest: awards.reduce<Date | null>((d, a) => (a.startDate && (!d || a.startDate > d) ? a.startDate : d), null) }))
    .sort((a, b) => b.total - a.total)
  return (
    <section className="overflow-x-auto rounded-lg border border-border">
      <h2 className="border-b border-border bg-muted/30 px-3 py-2 text-sm font-semibold">Who has won, and how much ({rows.length} competitors · {money(rows.reduce((t, r) => t + r.total, 0))} in total)</h2>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="px-3 py-1.5 font-medium">Competitor</th><th className="px-3 py-1.5 text-right font-medium">Awards</th><th className="px-3 py-1.5 text-right font-medium">Total won</th><th className="px-3 py-1.5 text-right font-medium">Of which workforce</th><th className="px-3 py-1.5 font-medium">Latest start</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border last:border-0">
              <td className="px-3 py-1.5 font-medium">{r.name}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.count}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{money(r.total)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.workforce > 0 ? money(r.workforce) : '—'}</td>
              <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.latest ? formatDate(r.latest) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

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
            {[...awards].sort((x, y) => Number(awardIsWorkforce(y)) - Number(awardIsWorkforce(x)) || y.amount - x.amount).slice(0, 15).map((a) => (
              <li key={a.id} className="space-y-0.5 p-3 text-sm">
                <a href={a.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{(a.description ?? a.awardId ?? 'Award').slice(0, 140)}</a>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {awardIsWorkforce(a) && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">Workforce</span>}
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


export function CompetitorWinsView({ rows, missing }: { rows: Awaited<ReturnType<typeof listCompetitorAwards>>; missing: boolean }) {
  const group = (conf: string) => {
    const m = new Map<string, typeof rows>()
    for (const r of rows.filter((x) => x.confidence === conf)) m.set(r.competitorName, [...(m.get(r.competitorName) ?? []), r])
    const wf = (l: typeof rows) => l.filter(awardIsWorkforce).reduce((t, x) => t + x.amount, 0)
    return [...m.entries()].sort((a, b) => wf(b[1]) - wf(a[1]) || b[1].reduce((t, x) => t + x.amount, 0) - a[1].reduce((t, x) => t + x.amount, 0))
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
          {exact.length === 0 ? <p className="text-sm text-muted-foreground">No wins found yet. The first pass fills this in.</p> : <><WinnersTable entries={exact} /><h2 className="text-sm font-semibold">Every award, by competitor</h2><Block entries={exact} /></>}
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
