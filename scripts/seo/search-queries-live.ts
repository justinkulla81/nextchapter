// Read-only: prints what the admin "Search queries" page would show right now (top queries, zero-click near misses, page-two queries,
// groups), straight from Search Console with the stored admin Google grant. Run: npx tsx --conditions react-server --env-file=.env.local scripts/seo/search-queries-live.ts [days]
import { loadSearchPerformanceUncached } from '@/lib/google/search-performance'
import { aggregateQueries, groupStats, nearMisses, pageTwoQueries, type PerfWindowDays } from '@/lib/seo/search-analysis'

async function main() {
  const days = (Number(process.argv[2]) || 28) as PerfWindowDays
  const r = await loadSearchPerformanceUncached(days)
  if (r.status !== 'ok') {
    console.log('status:', r.status, 'detail' in r ? r.detail : 'message' in r ? r.message : '')
    return
  }
  const queries = aggregateQueries(r.rows, r.prevRows)
  console.log(`site ${r.siteUrl}  window ${r.current.startDate}..${r.current.endDate} (prev ${r.previous.startDate}..${r.previous.endDate}) truncated=${r.truncated}`)
  console.log('totals', r.totals, 'prev', r.prevTotals, 'rows', r.rows.length, 'prevRows', r.prevRows.length)
  console.log('TOP QUERIES')
  for (const q of queries.slice(0, 10)) console.log(` ${q.clicks}c ${q.impressions}i pos ${q.position.toFixed(1)}  ${q.query}  -> ${q.topPage}`)
  console.log('NEAR MISSES (0 clicks)')
  for (const q of nearMisses(queries).slice(0, 10)) console.log(` ${q.impressions}i pos ${q.position.toFixed(1)}  ${q.query}`)
  console.log('PAGE TWO (pos 8-20)')
  for (const q of pageTwoQueries(queries).slice(0, 10)) console.log(` ${q.impressions}i pos ${q.position.toFixed(1)}  ${q.query}`)
  console.log('GROUPS')
  for (const g of groupStats(r.rows, r.prevRows)) console.log(` ${g.label}: ${g.queries} searches, ${g.clicks}c, ${g.impressions}i (prev ${g.prevClicks}c ${g.prevImpressions}i)`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
