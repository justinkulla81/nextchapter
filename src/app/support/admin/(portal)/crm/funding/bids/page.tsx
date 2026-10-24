import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { listOpenBoardBids } from '@/lib/bids/queries'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 30

const NEW_HOURS = 24 * 8

/** Open bids found on workforce boards' own procurement pages (read weekly, one request at a time). */
export default async function BoardBidsPage() {
  await requireAdmin()
  let rows: Awaited<ReturnType<typeof listOpenBoardBids>> = []
  let missing = false
  try {
    rows = await listOpenBoardBids()
  } catch {
    missing = true
  }
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
      )}
    </div>
  )
}
