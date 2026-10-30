import { requireAdmin } from '@/lib/admin/auth'
import { strikingDistance, type StrikingRow } from '@/lib/google/search-console'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

/** Pages with the most impressions on queries ranking 8 to 20, each with its queries, so a rewrite can target them. */
function byPage(rows: StrikingRow[]) {
  const pages = new Map<string, { page: string; impressions: number; clicks: number; rows: StrikingRow[] }>()
  for (const r of rows) {
    const p = pages.get(r.page) ?? { page: r.page, impressions: 0, clicks: 0, rows: [] }
    p.impressions += r.impressions
    p.clicks += r.clicks
    p.rows.push(r)
    pages.set(r.page, p)
  }
  return [...pages.values()].sort((a, b) => b.impressions - a.impressions)
}

export default async function SearchConsoleStrikingPage() {
  await requireAdmin()
  const result = await strikingDistance()
  if ('error' in result) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Pages ranking just off page one</h1>
        <p className="text-sm text-destructive">Google would not return the data: {result.error}</p>
      </div>
    )
  }
  const pages = byPage(result.rows).slice(0, 60)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pages ranking just off page one</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Search queries where a page averages position 8 to 20, seen at least 10 times, {result.startDate} to {result.endDate}. Rewrite the title and description of the pages at the top first. Each row is a page with the queries it nearly wins.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{result.rows.length.toLocaleString()} query and page pairs across {byPage(result.rows).length.toLocaleString()} pages. Showing the 60 pages with the most impressions.</p>
      </div>
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pair matches yet. Search Console reports about two days behind.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Page</th>
                <th className="px-2 py-2 font-medium">Impressions</th>
                <th className="px-2 py-2 font-medium">Clicks</th>
                <th className="px-2 py-2 font-medium">Queries it nearly wins (position, impressions, click rate)</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.page} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2"><a href={p.page} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-4">{p.page}</a></td>
                  <td className="px-2 py-2 tabular-nums">{p.impressions.toLocaleString()}</td>
                  <td className="px-2 py-2 tabular-nums">{p.clicks.toLocaleString()}</td>
                  <td className="px-2 py-2 text-xs">
                    {p.rows.slice(0, 5).map((r) => (
                      <div key={r.query}>{r.query} <span className="text-muted-foreground">({r.position.toFixed(1)}, {r.impressions.toLocaleString()}, {pct(r.ctr)})</span></div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
