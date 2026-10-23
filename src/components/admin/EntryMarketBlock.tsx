import { pctOf, type EntryMarket, type EntryMarketRow } from '@/lib/jobs/entry-market'

function Tile({ label, n, of, note }: { label: string; n: number; of: number | null; note: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{n.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">
        {of !== null && `${pctOf(n, of)} · `}
        {note}
      </p>
    </div>
  )
}

function Breakdown({ title, rows, label }: { title: string; rows: EntryMarketRow[]; label?: (k: string) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="px-2 py-1">{title}</th>
            <th className="px-2 py-1">Entry + early</th>
            <th className="px-2 py-1">No experience needed</th>
            <th className="px-2 py-1">Entry-level + AI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="px-2 py-1">{label ? label(r.key) : r.key}</td>
              <td className="px-2 py-1">{r.entry.toLocaleString()}</td>
              <td className="px-2 py-1">
                {r.noExp.toLocaleString()} <span className="text-muted-foreground">({pctOf(r.noExp, r.entry)})</span>
              </td>
              <td className="px-2 py-1">
                {r.entryAi.toLocaleString()} <span className="text-muted-foreground">({pctOf(r.entryAi, r.entry)})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const pretty = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** Entry-level numbers from the daily snapshot (entry-market-server.ts; rules: entry-filters.ts). */
export function EntryMarketBlock({ e }: { e: EntryMarket }) {
  return (
    <section className="space-y-3" aria-labelledby="entry-market">
      <h2 id="entry-market" className="text-lg font-semibold">Entry level</h2>
      <p className="text-xs text-muted-foreground">
        Live US jobs, a role listed more than once counted once, internships left out. Entry and early career = crawler level ENTRY_IC or EARLY_IC. Percentages of
        no-experience and AI jobs are of entry and early-career jobs.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Active US jobs" n={e.liveUs} of={null} note="the whole board" />
        <Tile label="Entry and early-career jobs" n={e.entry} of={e.liveUs} note="of active US jobs" />
        <Tile label="No experience needed" n={e.noExp} of={e.entry} note="the posting welcomes people without experience, in an allowlisted phrase" />
        <Tile
          label="Entry-level jobs asking for AI"
          n={e.entryAi}
          of={e.entry}
          note={`${(e.entryAi - e.entryAiPreferred).toLocaleString()} as a requirement, ${e.entryAiPreferred.toLocaleString()} only preferred or a plus`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Function (top 10)" rows={e.byFunction} />
        <Breakdown title="Industry (top 10)" rows={e.byIndustry} label={pretty} />
      </div>
      <Breakdown title="Employer sector" rows={e.bySector} label={pretty} />
    </section>
  )
}
