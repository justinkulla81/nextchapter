import Link from 'next/link'
import type { ReactNode } from 'react'
import type { SearchPerformanceResult } from '@/lib/google/search-performance'
import {
  PERF_WINDOWS,
  aggregatePages,
  aggregateQueries,
  groupStats,
  nearMisses,
  pageTwoQueries,
  pctChange,
  type PerfWindowDays,
  type QueryAgg,
} from '@/lib/seo/search-analysis'

// The admin "Search queries" page: what people search on Google to find us, what moved since the window before, and the cheapest
// places to win. Pure presentation over src/lib/seo/search-analysis.ts, so it renders the same in tests as on the page.

const SHOWN = 25
const SHOWN_PAGES = 15
const EXPORT = '/api/admin/search-queries/export'

const int = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (frac: number, digits = 1) => `${(frac * 100).toFixed(digits)}%`
const pos = (n: number) => (n > 0 ? n.toFixed(1) : '–')

/** "+3", "−2", "new" (nothing before), or "–". With impressions a percent follows when there is something to compare to. */
function delta(cur: number, prev: number, withPercent = false): string {
  if (cur === 0 && prev === 0) return '–'
  if (prev === 0) return 'new'
  const d = cur - prev
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  const p = withPercent ? pctChange(cur, prev) : null
  return `${sign}${int(Math.abs(d))}${p !== null && d !== 0 ? ` (${p > 0 ? '+' : '−'}${Math.abs(p * 100).toFixed(0)}%)` : ''}`
}

const deltaTone = (cur: number, prev: number) => (cur > prev ? 'text-success' : cur < prev ? 'text-destructive' : 'text-muted-foreground')

function pathOf(url: string): string {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}` || '/'
  } catch {
    return url
  }
}

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={`pb-1 font-normal ${right ? 'text-right' : ''}`}>{children}</th>
}

function Num({ children, tone }: { children: ReactNode; tone?: string }) {
  return <td className={`py-1.5 text-right tabular-nums ${tone ?? ''}`}>{children}</td>
}

function Block({ title, note, csv, days, children }: { title: string; note: string; csv?: string; days: PerfWindowDays; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{note}</p>
        </div>
        {csv && (
          <a href={`${EXPORT}?days=${days}&table=${csv}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            Download CSV
          </a>
        )}
      </div>
      {children}
    </section>
  )
}

function QueryTable({ rows, empty }: { rows: QueryAgg[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <Th>Search</Th>
          <Th>Landed on</Th>
          <Th right>Clicks</Th>
          <Th right>Seen</Th>
          <Th right>CTR</Th>
          <Th right>Position</Th>
          <Th right>Clicks vs before</Th>
          <Th right>Seen vs before</Th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, SHOWN).map((q) => (
          <tr key={q.query} className="border-t align-top">
            <td className="py-1.5 pr-3 font-medium">{q.query}</td>
            <td className="py-1.5 pr-3 text-xs text-muted-foreground">
              {pathOf(q.topPage)}
              {q.pages > 1 ? ` +${q.pages - 1} more` : ''}
            </td>
            <Num>{int(q.clicks)}</Num>
            <Num>{int(q.impressions)}</Num>
            <Num>{pct(q.ctr)}</Num>
            <Num>{pos(q.position)}</Num>
            <Num tone={deltaTone(q.clicks, q.prevClicks)}>{delta(q.clicks, q.prevClicks)}</Num>
            <Num tone={deltaTone(q.impressions, q.prevImpressions)}>{delta(q.impressions, q.prevImpressions, true)}</Num>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatusNotice({ result, days }: { result: Exclude<SearchPerformanceResult, { status: 'ok' }>; days: PerfWindowDays }) {
  const connectHref = `/api/google/oauth/start?from=/support/admin/search-queries`
  const connect = (
    <Link href={connectHref} className="text-primary underline underline-offset-4">
      Connect Google
    </Link>
  )
  let body: ReactNode
  if (result.status === 'not_connected') {
    body = <p>No Google account is connected yet. {connect} with an account that owns the launchyournextchapter.com property in Search Console, then come back here.</p>
  } else if (result.status === 'needs_reconnect') {
    body = (
      <div className="space-y-2">
        {result.reason === 'api_disabled' ? (
          <p>
            Google is refusing the request because the Search Console API is not switched on for NextChapter&apos;s Google Cloud project. Reconnecting will not fix this: turn on
            &quot;Google Search Console API&quot; in the Google Cloud console for the project that owns the OAuth client, then reload.
          </p>
        ) : result.reason === 'no_permission' ? (
          <p>The connected Google account is not an owner or user of the launchyournextchapter.com property in Search Console. {connect} with an account that is.</p>
        ) : (
          <p>Google says the connected account has not granted Search Console access. {connect} again and leave the Search Console permission ticked.</p>
        )}
        <p className="text-xs">What Google said: {result.detail}</p>
      </div>
    )
  } else if (result.status === 'no_site') {
    body = (
      <p>
        The connected Google account has no Search Console property for launchyournextchapter.com{result.sites.length > 0 ? ` (it can see: ${result.sites.join(', ')})` : ''}. Add and verify the site in
        Search Console, then reload.
      </p>
    )
  } else {
    body = <p>Search Console could not be read right now ({result.message}). Reload in a minute; if it keeps failing, check the Visitors page for the same message.</p>
  }
  return (
    <div role="status" className="space-y-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">No search data to show for the last {days} days.</p>
      {body}
    </div>
  )
}

export function SearchQueriesView({ result, days }: { result: SearchPerformanceResult; days: PerfWindowDays }) {
  const header = (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search queries</h1>
        <p className="mt-1 text-muted-foreground">
          What people search on Google to find us, what moved since the window before, and the cheapest places to win. From Google Search Console, read-only.
        </p>
      </div>
      <div className="flex gap-2" role="group" aria-label="Time window">
        {PERF_WINDOWS.map((w) => (
          <Link
            key={w}
            href={`/support/admin/search-queries?days=${w}`}
            aria-current={w === days ? 'true' : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm ${w === days ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            Last {w} days
          </Link>
        ))}
      </div>
    </div>
  )

  if (result.status !== 'ok') {
    return (
      <div className="mx-auto max-w-5xl space-y-10 p-6">
        {header}
        <StatusNotice result={result} days={days} />
      </div>
    )
  }

  const queries = aggregateQueries(result.rows, result.prevRows)
  const pages = aggregatePages(result.rows, result.prevRows)
  const misses = nearMisses(queries)
  const pageTwo = pageTwoQueries(queries)
  const groups = groupStats(result.rows, result.prevRows)
  const t = result.totals
  const p = result.prevTotals
  const hiddenImpressions = Math.max(0, t.impressions - result.rows.reduce((s, r) => s + r.impressions, 0))
  const hiddenShare = t.impressions > 0 ? hiddenImpressions / t.impressions : 0

  const cards: { label: string; value: string; change: string; tone: string }[] = [
    { label: 'Clicks', value: int(t.clicks), change: `${delta(t.clicks, p.clicks, true)} vs before`, tone: deltaTone(t.clicks, p.clicks) },
    { label: 'Seen in results (impressions)', value: int(t.impressions), change: `${delta(t.impressions, p.impressions, true)} vs before`, tone: deltaTone(t.impressions, p.impressions) },
    { label: 'Click-through rate', value: pct(t.ctr), change: p.impressions > 0 ? `${pct(p.ctr)} before` : 'no data before', tone: 'text-muted-foreground' },
    {
      label: 'Average position',
      value: pos(t.position),
      change: p.position > 0 && t.position > 0 ? (t.position < p.position ? `${(p.position - t.position).toFixed(1)} places better` : t.position > p.position ? `${(t.position - p.position).toFixed(1)} places worse` : 'unchanged') : 'no data before',
      tone: p.position > 0 && t.position > 0 ? (t.position < p.position ? 'text-success' : t.position > p.position ? 'text-destructive' : 'text-muted-foreground') : 'text-muted-foreground',
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      {header}
      <p className="text-sm text-muted-foreground">
        {result.siteUrl}, {result.current.startDate} to {result.current.endDate}, compared with {result.previous.startDate} to {result.previous.endDate}. Google lags about two days.
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{c.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</dd>
            <dd className={`text-xs ${c.tone}`}>{c.change}</dd>
          </div>
        ))}
      </dl>

      {t.impressions === 0 && (
        <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">
          Google reported no impressions for this window. A new site or a window right after a change can be empty; try a longer window.
        </p>
      )}
      {(result.truncated || hiddenShare >= 0.05) && (
        <p className="text-xs text-muted-foreground">
          {result.truncated ? 'Google returned a full page of rows, so the lists below may be missing the rarest searches. ' : ''}
          {hiddenShare >= 0.05 ? `${pct(hiddenShare, 0)} of impressions come from searches Google hides for privacy; they are in the totals above but not in the lists below.` : ''}
        </p>
      )}

      <Block title="1 · Groups we watch" note="Clusters of searches, so you can see which topic is moving. Edit the list in src/lib/seo/query-groups.ts. A search can sit in more than one group." csv="groups" days={days}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <Th>Group</Th>
              <Th right>Searches</Th>
              <Th right>Clicks</Th>
              <Th right>Seen</Th>
              <Th right>Position</Th>
              <Th right>Clicks vs before</Th>
              <Th right>Seen vs before</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className="border-t align-top">
                <td className="py-1.5 pr-3">
                  <div className="font-medium">{g.label}</div>
                  <div className="text-xs text-muted-foreground">{g.note}</div>
                </td>
                <Num>{int(g.queries)}</Num>
                <Num>{int(g.clicks)}</Num>
                <Num>{int(g.impressions)}</Num>
                <Num>{pos(g.position)}</Num>
                <Num tone={deltaTone(g.clicks, g.prevClicks)}>{delta(g.clicks, g.prevClicks)}</Num>
                <Num tone={deltaTone(g.impressions, g.prevImpressions)}>{delta(g.impressions, g.prevImpressions, true)}</Num>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block title="2 · Top searches" note={`The ${SHOWN} searches that sent the most clicks, then the most impressions, with the page Google sent them to.`} csv="queries" days={days}>
        <QueryTable rows={queries} empty="No searches in this window." />
      </Block>

      <Block title="3 · Seen but never clicked" note="Searches where we showed up and nobody clicked (3 or more impressions). The title or snippet may not match what they wanted, or we sit too low to be noticed." csv="near" days={days}>
        <QueryTable rows={misses} empty="No search was seen 3 or more times without a click." />
      </Block>

      <Block title="4 · Page-two searches (position 8 to 20)" note="We rank just below the fold or on page two for these (3 or more impressions). They are the cheapest wins: a better title, a clearer answer and a few internal links can move them up." csv="page2" days={days}>
        <QueryTable rows={pageTwo} empty="No search averaged position 8 to 20 with 3 or more impressions." />
      </Block>

      <Block title="5 · Top pages" note={`The ${SHOWN_PAGES} pages that got the most clicks from Google search.`} csv="pages" days={days}>
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pages in this window.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <Th>Page</Th>
                <Th right>Clicks</Th>
                <Th right>Seen</Th>
                <Th right>CTR</Th>
                <Th right>Position</Th>
                <Th right>Clicks vs before</Th>
                <Th right>Seen vs before</Th>
              </tr>
            </thead>
            <tbody>
              {pages.slice(0, SHOWN_PAGES).map((pg) => (
                <tr key={pg.page} className="border-t align-top">
                  <td className="py-1.5 pr-3 font-medium">{pathOf(pg.page)}</td>
                  <Num>{int(pg.clicks)}</Num>
                  <Num>{int(pg.impressions)}</Num>
                  <Num>{pct(pg.ctr)}</Num>
                  <Num>{pos(pg.position)}</Num>
                  <Num tone={deltaTone(pg.clicks, pg.prevClicks)}>{delta(pg.clicks, pg.prevClicks)}</Num>
                  <Num tone={deltaTone(pg.impressions, pg.prevImpressions)}>{delta(pg.impressions, pg.prevImpressions, true)}</Num>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>

      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-medium">How to read this</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>Seen (impressions) is how often we appeared in Google results. Clicks is how often someone chose us. CTR is clicks divided by seen.</li>
          <li>Position is Google&apos;s average: 1 is the top of page one, about 10 is the bottom of page one, 11 to 20 is page two. Lower is better.</li>
          <li>&quot;vs before&quot; compares with the window of the same length right before this one. &quot;new&quot; means it had no data before.</li>
          <li>Few searches at this size of site: a change of 1 or 2 clicks is noise. Read the direction over several weeks, not one week.</li>
          <li>Seen but never clicked, with a low position number (under 8): the title or description is the problem. With a high number (over 20): ranking is.</li>
          <li>Search Console keeps 16 months. The full list of every search term downloads from the Visitors page.</li>
        </ul>
      </details>
    </div>
  )
}
