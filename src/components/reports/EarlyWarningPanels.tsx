import { monthLabel, monthShort } from '@/lib/reports-wc-index'
import { movingAverage3 } from '@/lib/reports/early-warning-analysis'
import {
  GROUP_LABEL, SHOCK_WINDOW, US_GROUPS, canaryTests, latestEarlyWarningEdition, readAiLayoffEvents, readAiLayoffs,
  readPeers, readUsEarlyWarning, summarizePeers, usYoY, type CanaryResult, type UsGroup, type UsMonthly,
} from '@/lib/reports-early-warning'

const LICENSE = 'https://creativecommons.org/licenses/by/4.0/'

const COUNTRY_NAMES: Record<string, string> = {
  USA: 'United States', GBR: 'United Kingdom', CAN: 'Canada', AUS: 'Australia', JPN: 'Japan', DEU: 'Germany', FRA: 'France',
  ITA: 'Italy', ESP: 'Spain', NLD: 'Netherlands', SWE: 'Sweden', IND: 'India', CHE: 'Switzerland', IRL: 'Ireland', SGP: 'Singapore',
}
const countryName = (iso3: string) => COUNTRY_NAMES[iso3] ?? iso3

const f1 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(1))
const signed = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`)

/**
 * Everything the early-warning section shows, computed from one edition's
 * snapshot files (the newest when no edition is given).
 */
export function buildEarlyWarning(edition?: string | null) {
  const ed = edition ?? latestEarlyWarningEdition()
  const us = readUsEarlyWarning(ed)
  const yoy = usYoY(us)
  const usMonths = [...us.all.keys()].sort()
  const LATEST = usMonths[usMonths.length - 1]
  const rows = US_GROUPS.map((g) => {
    const ma = movingAverage3(new Map([...us[g]].map(([k, v]) => [k, v.ur])))
    const month = [...ma.keys()].sort().at(-1)!
    return { g, month, ur: ma.get(month)!, change: yoy[g].get(month) ?? null, point: us[g].get(month) }
  })
  const worst = [...rows].filter((r) => r.g !== 'all' && r.change !== null).sort((a, b) => b.change! - a.change!)[0]
  const lead = !worst
    ? `Early-warning indicators through ${monthLabel(LATEST)}.`
    : Math.abs(worst.change!) < 0.3
      ? `Through ${monthLabel(worst.month)}, no tracked U.S. group’s unemployment rate has moved by more than ${Math.max(...rows.filter((r) => r.change !== null).map((r) => Math.abs(r.change!))).toFixed(1)} points in a year.`
      : `Over the past year, unemployment rose most for ${GROUP_LABEL[worst.g].toLowerCase()}: ${signed(worst.change)} points, to ${f1(worst.ur)}% (3-month average to ${monthLabel(worst.month)}).`
  const peers = readPeers(ed)
  return {
    edition: ed, us, usMonths, LATEST, rows, lead, peers, peerRows: summarizePeers(peers),
    canary: canaryTests(us, SHOCK_WINDOW),
    aiLayoffs: readAiLayoffs(edition), aiEvents: readAiLayoffEvents(edition),
  }
}

// ---- chart --------------------------------------------------------------------

// ---- chart --------------------------------------------------------------------

const W = 720, H = 320, M = { t: 14, r: 12, b: 28, l: 38 }
const COLORS: Record<UsGroup, string> = { all: '#8892a0', wc: '#4a5568', grad: '#c4574a', wc_early: '#d98a1f', wc_senior: '#1d4e89' }
const yearOf = (m: string) => { const [y, mo] = m.split('-').map(Number); return y + (mo - 1) / 12 }

function Chart({ groups, from, us, usMonths }: { groups: UsGroup[]; from: number; us: UsMonthly; usMonths: string[] }) {
  const series = groups.map((g) => {
    const ma = movingAverage3(new Map([...us[g]].map(([k, v]) => [k, v.ur])))
    return { g, pts: [...ma].filter(([m]) => yearOf(m) >= from).sort(([a], [b]) => a.localeCompare(b)) }
  })
  const all = series.flatMap((s) => s.pts.map(([, v]) => v))
  const yMax = Math.ceil(Math.max(...all) / 2) * 2
  const x1 = yearOf(usMonths[usMonths.length - 1]) + 1 / 12
  const X = (yr: number) => M.l + ((yr - from) / (x1 - from)) * (W - M.l - M.r)
  const Y = (v: number) => M.t + ((yMax - v) / yMax) * (H - M.t - M.b)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full"
      aria-label={`Unemployment rate, 3-month average, ${groups.map((g) => GROUP_LABEL[g]).join(', ')}, ${from} to ${monthShort(usMonths[usMonths.length - 1])}.`}>
      {Array.from({ length: yMax / 2 + 1 }, (_, i) => i * 2).map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke="#e2e8f0" />
          <text x={M.l - 6} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="#8892a0">{v}%</text>
        </g>
      ))}
      {Array.from({ length: Math.floor(x1) - from + 1 }, (_, i) => from + i).filter((y) => y % 2 === from % 2).map((yr) => (
        <text key={yr} x={X(yr)} y={H - 8} textAnchor="middle" fontSize={11} fill="#8892a0">{yr}</text>
      ))}
      {series.map(({ g, pts }) => {
        // Break the line across any gap of more than one month (October 2025 was not collected).
        const segs: [string, number][][] = []
        let cur: [string, number][] = []
        let prev: number | null = null
        for (const p of pts) {
          const i = Math.round(yearOf(p[0]) * 12)
          if (prev !== null && i - prev > 1) { segs.push(cur); cur = [] }
          cur.push(p); prev = i
        }
        if (cur.length) segs.push(cur)
        return segs.map((seg, i) => (
          <path key={`${g}${i}`} fill="none" stroke={COLORS[g]} strokeWidth={g === 'grad' ? 2.4 : 1.8} strokeLinejoin="round"
            d={'M' + seg.map(([m, v]) => `${X(yearOf(m)).toFixed(1)} ${Y(v).toFixed(1)}`).join('L')} />
        ))
      })}
    </svg>
  )
}

function Legend({ groups }: { groups: UsGroup[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      {groups.map((g) => (
        <li key={g} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-5" style={{ background: COLORS[g] }} />
          {GROUP_LABEL[g]}
        </li>
      ))}
    </ul>
  )
}

// ---- canary summary -------------------------------------------------------------

// ---- canary summary -------------------------------------------------------------

const VERDICT_TEXT = { leads: 'Leads', 'moves-with': 'Moves together', unclear: 'No clear link' } as const

function canaryLine(c: CanaryResult) {
  const b = c.leadLag.best
  if (!b) return 'not enough data'
  return `${VERDICT_TEXT[c.verdict]} (best at ${b.lag} month${b.lag === 1 ? '' : 's'}, r = ${b.r.toFixed(2)})`
}


/**
 * The early-warning section: U.S. groups, the canary test, job cuts citing AI by
 * country, and the peer-economy comparison. Used by /reports/early-warning (newest
 * data) and by each monthly edition page from October 2026 (that edition's snapshot).
 */
export function EarlyWarningPanels({ edition }: { edition?: string | null }) {
  const m = buildEarlyWarning(edition)
  const { us, usMonths, LATEST, rows, peers, peerRows, canary, aiLayoffs, aiEvents } = m
  const base = m.edition ? `/reports/early-warning/${m.edition}` : '/reports'
  // AI-layoff files for the running latest sit at the top level of /reports.
  const aiBase = edition ? base : '/reports'
  const chartGroups: UsGroup[] = ['grad', 'wc_early', 'wc_senior', 'all']
  const peersSorted = [...peerRows].sort((a, b) => (b.ratio - (b.ratioYearAgo ?? b.ratio)) - (a.ratio - (a.ratioYearAgo ?? a.ratio)))
  const usUsAi = peers.us_ai_use.at(-1)
  const leaders = canary.filter((c) => c.verdict === 'leads')
  const CANARY_HEADLINE = leaders.length
    ? `The data support a canary effect: ${[...new Set(leaders.map((c) => GROUP_LABEL[c.candidate].toLowerCase()))].join(' and ')} moved before ${[...new Set(leaders.map((c) => GROUP_LABEL[c.target].toLowerCase()))].join(' and ')} in the ${monthShort(usMonths[0])}–${monthShort(LATEST)} history.`
    : `The data do not show a clean lead: young graduates and early-career white-collar workers tend to move with the wider market, not ahead of it, in the ${monthShort(usMonths[0])}–${monthShort(LATEST)} history.`
  const aiLatestMonth = aiLayoffs.map((r) => r.month).sort().at(-1) ?? null
  const aiJobsByCountry = new Map(aiLayoffs.filter((r) => r.month === aiLatestMonth).map((r) => [r.country, r.jobs]))
  const aiRowsSorted = [...aiLayoffs].sort((a, b) => b.month.localeCompare(a.month) || b.jobs - a.jobs)

  return (
    <>
        {/* US groups */}
        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight text-navy">United States: who is hurting, and where</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Group</th>
                  <th className="py-2 pr-4 text-right font-medium">Unemployment rate</th>
                  <th className="py-2 pr-4 text-right font-medium">Change, 12 months</th>
                  <th className="py-2 pr-4 text-right font-medium">Employed, share of population</th>
                  <th className="py-2 pr-4 text-right font-medium">Out 27+ weeks, share of unemployed</th>
                  <th className="py-2 text-right font-medium">Median weeks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.g} className="border-b border-light-gray/70">
                    <td className="py-2 pr-4">{GROUP_LABEL[r.g]}</td>
                    <td className="py-2 pr-4 text-right">{f1(r.ur)}%</td>
                    <td className="py-2 pr-4 text-right">{signed(r.change)} pts</td>
                    <td className="py-2 pr-4 text-right">{r.g === 'all' || r.g === 'grad' ? `${f1(r.point?.epop)}%` : 'n/a'}</td>
                    <td className="py-2 pr-4 text-right">{f1(r.point?.ltuShare)}%</td>
                    <td className="py-2 text-right">{r.point ? Math.round(r.point.medianWeeks) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Unemployment rate and 12-month change are 3-month averages to {monthLabel(rows[0].month)}; the other columns are the single latest
            month ({monthLabel(LATEST)}). Not seasonally adjusted at source, so the 12-month change compares like months. The employed share is shown only for groups defined by age and education; the occupation groups are defined by a current or most recent job, so everyone in them has worked and the share would read near 100%. Small groups are noisy:
            graduates 22–27 have roughly {Math.round(us.grad.get(LATEST)?.nUnemployed ?? 0)} unemployed survey respondents in the latest month, so read a single
            month with care.
          </p>

          <figure className="mt-8 rounded-xl border border-light-gray bg-white p-5">
            <figcaption className="text-sm font-semibold text-navy">Unemployment rate, 3-month average, 2015 – {monthShort(LATEST)}</figcaption>
            <div className="mt-3"><Chart groups={chartGroups} from={2015} us={us} usMonths={usMonths} /></div>
            <Legend groups={chartGroups} />
          </figure>
        </section>

        {/* Canary test */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-navy">Is anyone a canary in the coal mine?</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground">{CANARY_HEADLINE}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Candidate signal</th>
                  <th className="py-2 pr-4 font-medium">Compared with</th>
                  <th className="py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {canary.map((c) => (
                  <tr key={`${c.candidate}-${c.target}`} className="border-b border-light-gray/70">
                    <td className="py-2 pr-4">{GROUP_LABEL[c.candidate]}</td>
                    <td className="py-2 pr-4">{GROUP_LABEL[c.target]}</td>
                    <td className="py-2">{canaryLine(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Method: for each month, the 12-month change in the 3-month-average unemployment rate of the candidate group is correlated with the
            same measure for the comparison group 0 to 12 months later. A group is called a leader only if the best lag is at least three months,
            the correlation is 0.4 or higher, and it beats the same-month correlation. March 2020 through February 2022 is left out, because the
            pandemic shock and rebound would otherwise dominate every comparison. The remaining history has no sharp downturn, so a lead
            that only appears in one would not show here. Correlation is not causation; treat this as a screen, not a forecast.
          </p>
        </section>

        {/* AI layoffs by country */}
        {aiLayoffs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight text-navy">Job cuts that cite AI, by country</h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground">
              Layoff announcements NextChapter tracks where news coverage ties the cuts to AI, automation or machine learning, grouped by the
              country the company is based in.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-light-gray text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Month</th>
                    <th className="py-2 pr-4 font-medium">Country</th>
                    <th className="py-2 pr-4 text-right font-medium">Companies citing AI</th>
                    <th className="py-2 pr-4 text-right font-medium">Announced jobs</th>
                    <th className="py-2 text-right font-medium">Companies saying AI is not the cause</th>
                  </tr>
                </thead>
                <tbody>
                  {aiRowsSorted.map((r) => (
                    <tr key={`${r.month}-${r.country}`} className="border-b border-light-gray/70">
                      <td className="py-2 pr-4">{monthLabel(r.month)}</td>
                      <td className="py-2 pr-4">{countryName(r.country)}</td>
                      <td className="py-2 pr-4 text-right">{r.cited}</td>
                      <td className="py-2 pr-4 text-right">{r.jobs.toLocaleString('en-US')}</td>
                      <td className="py-2 text-right">{r.denied}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {aiEvents.length > 0 && (
              <details className="mt-4 max-w-3xl text-sm">
                <summary className="cursor-pointer font-medium text-navy">The {aiEvents.length} announcements behind these counts</summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {aiEvents.map((e) => (
                    <li key={`${e.month}-${e.employer}`}>
                      {e.employer} ({countryName(e.country)}), {e.jobs > 0 ? `${e.jobs.toLocaleString('en-US')} jobs` : 'headcount not stated'}:{' '}
                      {e.claim === 'cited' ? 'coverage ties it to AI' : 'company said AI is not the cause'}
                      {e.url && <> · <a href={e.url} className="text-brand underline underline-offset-4" rel="noopener noreferrer">source</a></>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              This is what the coverage says each company claimed, counted once per company per month. It does not verify that AI was the cause:
              companies sometimes cite AI for cuts driven by cost or demand, and some say outright that AI is not the reason. Country is the
              company’s home country, not where the jobs are lost; a global cut counts at headquarters. It covers only announcements on
              NextChapter’s tracked list, so large announcements not on it are missing. Collection began in October 2026, so there is no
              earlier history. The AI-washing check on SEC restructuring filings in the monthly report tests the claim directly.
            </p>
          </section>
        )}

        {/* Peers */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-navy">Compared with ten peer economies</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground">
            Young workers everywhere are unemployed at a higher rate than the overall workforce. What matters for the canary question is whether that
            gap is <em>widening</em>, and whether it is widening more where AI adoption is higher or growth is weaker. Sorted by how much the
            youth-to-total ratio grew over the past year.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Country</th>
                  <th className="py-2 pr-3 text-right font-medium">Youth (15–24)</th>
                  <th className="py-2 pr-3 text-right font-medium">All ages</th>
                  <th className="py-2 pr-3 text-right font-medium">Youth ÷ all</th>
                  <th className="py-2 pr-3 text-right font-medium">Ratio, 12 mo ago</th>
                  <th className="py-2 pr-3 text-right font-medium">All-ages change</th>
                  <th className="py-2 pr-3 text-right font-medium">Graduate vs upper-secondary gap</th>
                  <th className="py-2 pr-3 text-right font-medium">Jobless 12+ months</th>
                  <th className="py-2 pr-3 text-right font-medium">GDP growth</th>
                  <th className="py-2 pr-3 text-right font-medium">Firms using AI</th>
                  <th className="py-2 text-right font-medium">Jobs cut citing AI, tracked{aiLatestMonth ? ` (${monthShort(aiLatestMonth)})` : ''}</th>
                </tr>
              </thead>
              <tbody>
                {peersSorted.map((p) => (
                  <tr key={p.code} className={`border-b border-light-gray/70 ${p.code === 'USA' ? 'bg-off-white font-medium' : ''}`}>
                    <td className="py-2 pr-3 whitespace-nowrap">{p.name}<span className="text-xs text-muted-foreground"> · {monthShort(p.month)}</span></td>
                    <td className="py-2 pr-3 text-right">{f1(p.youth)}%</td>
                    <td className="py-2 pr-3 text-right">{f1(p.total)}%</td>
                    <td className="py-2 pr-3 text-right">{p.ratio.toFixed(2)}×</td>
                    <td className="py-2 pr-3 text-right">{p.ratioYearAgo === null ? '—' : `${p.ratioYearAgo.toFixed(2)}×`}</td>
                    <td className="py-2 pr-3 text-right">{signed(p.totalChange)} pts</td>
                    <td className="py-2 pr-3 text-right">{signed(p.gradGap)} pts</td>
                    <td className="py-2 pr-3 text-right">{p.longTermShare === null ? '—' : `${f1(p.longTermShare)}%`}</td>
                    <td className="py-2 pr-3 text-right">{p.gdpLatest ? `${signed(p.gdpLatest.value)}% (${p.gdpLatest.year})` : '—'}</td>
                    <td className="py-2 pr-3 text-right">{p.aiAdoption ? `${f1(p.aiAdoption.value)}% (${p.aiAdoption.year})` : 'n/a'}</td>
                    <td className="py-2 text-right">{aiJobsByCountry.has(p.code) ? aiJobsByCountry.get(p.code)!.toLocaleString('en-US') : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>Youth and all-ages rates are seasonally adjusted (OECD); the latest month differs by country because statistical offices publish on different schedules.</li>
            <li>Graduate gap = unemployment rate of tertiary-educated 25–34 year-olds minus that of 25–34 year-olds with upper-secondary education (latest year, OECD). A negative number means graduates fare better; a number near zero or positive means the usual degree advantage has gone.</li>
            <li>“Jobless 12+ months” is the share of all unemployed people out a year or longer (OECD, latest year).</li>
            <li>“Firms using AI”: Eurostat for the six EU countries (share of enterprises with 10+ staff, 2025 uses a revised survey so is not strictly comparable with earlier years); for the U.S., the Census Bureau’s Business Trends and Outlook Survey ({usUsAi ? `${f1(usUsAi.pct)}%` : 'n/a'} of businesses of all sizes in the latest two-week period). The two measures differ in who is counted and are not directly comparable. No consistent figure is available here for the UK, Canada, Australia or Japan.</li>
            <li>“Jobs cut citing AI” counts only layoff announcements NextChapter tracks, by the company’s home country and not where the jobs are lost; see the AI section above. Zero means none tracked, not none happened.</li>
            <li>GDP growth is real annual growth for the latest full year (IMF World Economic Outlook; recent years may be estimates).</li>
            <li>With eleven countries and few matched AI figures, this table is descriptive. It cannot show that AI adoption causes any of these differences.</li>
          </ul>
        </section>

        {/* Sources */}
        <section className="mt-12 rounded-xl border border-light-gray bg-off-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">Sources and data</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
            <li>U.S.: Census Bureau Current Population Survey basic monthly microdata, NextChapter calculation. Graduates are ages 22–27 with a bachelor’s degree or more; white-collar is Census major occupation groups 1–2 for the current or most recent job.</li>
            {Object.values(peers.sources).map((s) => <li key={s}>{s}.</li>)}
          </ul>
          <p className="mt-4 flex flex-wrap gap-3">
            <a href={`${base}/us-early-warning.csv`} download className="inline-flex items-center rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white">U.S. series (CSV)</a>
            <a href={`${base}/early-warning-peers.json`} download className="inline-flex items-center rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white">Peer countries (JSON)</a>
            {aiLayoffs.length > 0 && <a href={`${aiBase}/ai-layoffs-monthly.csv`} download className="inline-flex items-center rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white">AI layoff announcements (CSV)</a>}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Data and charts may be republished with attribution under <a href={LICENSE} className="text-brand underline underline-offset-4" rel="license">CC BY 4.0</a>.
            Peer data refreshed {peers.generated}.
          </p>
        </section>
    </>
  )
}
