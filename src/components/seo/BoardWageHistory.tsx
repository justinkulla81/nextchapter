import { H2 } from '@/components/seo/SeoPage'
import { payChangePct, type BoardWageHistory as History, type BoardWageSeries } from '@/lib/workforce/board-wage-history'

// Jobs and pay in a workforce board's area, 2015 to 2025, from BLS QCEW annual averages (private sector). Plain SVG, no script.
const W = 320
const H = 120
const PAD = 8

const n0 = (n: number) => n.toLocaleString('en-US')
const usd = (n: number) => `$${n0(n)}`
const pct = (v: number | null) => (v == null ? 'n/a' : `${v > 0 ? '+' : ''}${v}%`)

function Line({ years, values, label, fmt }: { years: number[]; values: (number | null)[]; label: string; fmt: (n: number) => string }) {
  const pts = values.map((v, i) => (v == null ? null : { v, i })).filter((p): p is { v: number; i: number } => p !== null)
  if (pts.length < 2) return null
  const min = Math.min(...pts.map((p) => p.v))
  const max = Math.max(...pts.map((p) => p.v))
  const span = max - min || 1
  const x = (i: number) => PAD + ((W - 2 * PAD) * i) / (years.length - 1)
  const y = (v: number) => H - PAD - 4 - ((H - 2 * PAD - 18) * (v - min)) / span
  const first = pts[0]
  const last = pts[pts.length - 1]
  const summary = `${label}: ${fmt(first.v)} in ${years[first.i]}, ${fmt(last.v)} in ${years[last.i]}`
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <polyline fill="none" stroke="#1f5fbf" strokeWidth={2} points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} />
        <circle cx={x(first.i)} cy={y(first.v)} r={3} fill="#1f5fbf" />
        <circle cx={x(last.i)} cy={y(last.v)} r={3} fill="#1f5fbf" />
        <text x={x(first.i)} y={y(first.v) - 7} fontSize={11} fill="#14233a">{fmt(first.v)}</text>
        <text x={x(last.i)} y={y(last.v) - 7} fontSize={11} textAnchor="end" fill="#14233a">{fmt(last.v)}</text>
        <text x={PAD} y={H} fontSize={10} fill="#5a6a80">{years[0]}</text>
        <text x={W - PAD} y={H} fontSize={10} textAnchor="end" fill="#5a6a80">{years[years.length - 1]}</text>
      </svg>
      <figcaption className="mt-1 text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  )
}

const ROW_ORDER = ['51', '52', '54', '55', '62', '31-33', '23', '44-45', '72']

function jobsChange(s: BoardWageSeries, from: number, to: number, years: number[]) {
  const a = s.e[years.indexOf(from)]
  const b = s.e[years.indexOf(to)]
  return a && b ? Math.round(((b - a) / a) * 1000) / 10 : null
}

/** The section for a workforce board's page; renders nothing when the board is not in the QCEW file. */
export function BoardWageHistory({ history, areaName }: { history: History | null; areaName: string }) {
  const all = history?.series['10']
  if (!history || !all) return null
  const { years } = history
  const last = years.length - 1
  const jobs = all.e[last]
  const pay = all.p[last]
  if (jobs == null || pay == null) return null
  const partial = all.n[last] < history.counties
  const rows = ROW_ORDER.filter((c) => history.series[c] && history.series[c].e[last] != null)
  return (
    <section aria-labelledby="wage-history" className="mt-12">
      <h2 id="wage-history" className={H2}>Jobs and pay in {areaName}, {years[0]} to {years[last]}</h2>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
        Private-sector employers in the area employed {n0(jobs)} people in {years[last]} at an average of {usd(pay)} a year. Jobs are {pct(jobsChange(all, years[0], years[last], years))} and average pay is {pct(payChangePct(all, years, years[0], years[last]))} since {years[0]}, before adjusting for inflation.
      </p>
      <div className="mt-4 grid max-w-3xl gap-6 sm:grid-cols-2">
        <Line years={years} values={all.e} label="Average annual private-sector jobs" fmt={n0} />
        <Line years={years} values={all.p} label="Average annual pay, private sector (not adjusted for inflation)" fmt={usd} />
      </div>
      <div className="mt-6 max-w-3xl overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">Jobs and pay by industry in {areaName}, {years[0]} to {years[last]}</caption>
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="p-3 font-medium">Industry</th>
              <th scope="col" className="p-3 text-right font-medium">Jobs, {years[last]}</th>
              <th scope="col" className="p-3 text-right font-medium">Jobs since {years[0]}</th>
              <th scope="col" className="p-3 text-right font-medium">Average pay</th>
              <th scope="col" className="p-3 text-right font-medium">Pay since {years[0]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => {
              const s = history.series[c]
              const p = s.p[last]
              return (
                <tr key={c}>
                  <th scope="row" className="p-3 text-left font-medium text-navy">{history.sectors[c]}</th>
                  <td className="p-3 text-right tabular-nums">{n0(s.e[last] as number)}</td>
                  <td className="p-3 text-right tabular-nums">{pct(jobsChange(s, years[0], years[last], years))}</td>
                  <td className="p-3 text-right tabular-nums">{p != null ? usd(p) : 'n/a'}</td>
                  <td className="p-3 text-right tabular-nums">{pct(payChangePct(s, years, years[0], years[last]))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
        Source: U.S. Bureau of Labor Statistics, Quarterly Census of Employment and Wages, annual averages, private ownership, summed over the area’s counties.
        {partial && ` The ${years[last]} figure rests on ${all.n[last]} of the area’s ${history.counties} counties; BLS withholds some county figures to protect employer privacy.`}
        {' '}An industry is left out when BLS withholds its figure for the whole area.
      </p>
    </section>
  )
}
