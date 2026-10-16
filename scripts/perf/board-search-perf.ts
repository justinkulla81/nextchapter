// Board search: timing, memory and no-search parity on real data. Read-only.
//
//   set -a; . ./.env.local; set +a
//   node --expose-gc --conditions=react-server --import tsx scripts/perf/board-search-perf.ts [members]
//
// Parity: with no search entered, loadBoardShortlist must return exactly what
// origin/main's does (copy it to scripts/perf/tmp-main-board-shortlist.ts first:
// git show origin/main:src/lib/jobs/board-shortlist.ts > scripts/perf/tmp-main-board-shortlist.ts).
import { prisma } from '@/lib/prisma'
import { loadBoardShortlist } from '@/lib/jobs/board-shortlist'
import { buildBoardSearch, loadSearchIndex } from '@/lib/jobs/board-search-index'
import { parseBoardSearchParams } from '@/lib/jobs/board-search'
import { memberStageWindow } from '@/lib/jobs/career-stage'
import { defaultWorkTypes } from '@/lib/jobs/work-type'

const mb = () => {
  ;(globalThis as { gc?: () => void }).gc?.()
  return Math.round(process.memoryUsage().heapUsed / 1e6)
}
const ms = (t: number) => `${Math.round(performance.now() - t)} ms`

async function main() {
  const n = Number(process.argv[2] ?? 5)
  const members = await prisma.candidateProfile.findMany({ where: { isSampleData: false }, orderBy: { createdAt: 'desc' }, take: n })
  const baseOpts = (c: (typeof members)[number]) => ({
    candidate: c,
    isCandidatePlus: true,
    where: {},
    stageWindow: memberStageWindow(c),
    includeMidLevel: true,
    includeEarlyCareer: true,
    workTypes: defaultWorkTypes(c),
  })

  // Warm the board (no search).
  let t = performance.now()
  await loadBoardShortlist(baseOpts(members[0]))
  console.log(`board cold load (no search): ${ms(t)}, heap ${mb()} MB`)
  t = performance.now()
  await loadBoardShortlist(baseOpts(members[0]))
  console.log(`board warm (no search): ${ms(t)}`)

  // Parity with origin/main when no search is entered.
  const main = (await import(/* optional, see above */ `./${'tmp-main-board-shortlist'}`).catch(() => null)) as { loadBoardShortlist: typeof loadBoardShortlist } | null
  if (main) {
    let same = 0
    for (const c of members) {
      for (const view of ['all', 'fresh', 'low_competition'] as const) {
        const o = { ...baseOpts(c), view, isCandidatePlus: c.id.charCodeAt(0) % 2 === 0 }
        const a = await main.loadBoardShortlist(o as never)
        const b = await loadBoardShortlist({ ...o, ...parseNoSearch() })
        const key = (x: typeof b) => JSON.stringify([x.open.map((p) => p.id), x.locked.map((p) => p.id), x.openTotal, x.lockedTotal, x.freshOpenTotal, x.lowCompetitionOpenTotal, x.countByWorkType])
        if (key(a as never) === key(b)) same++
        else console.log(`PARITY MISMATCH member ${c.id} view ${view}`)
      }
    }
    console.log(`no-search parity vs origin/main: ${same}/${members.length * 3} identical`)
  }

  const before = mb()
  t = performance.now()
  const index = await loadSearchIndex()
  console.log(`search index cold load: ${ms(t)} (query+build ${index.loadedMs} ms), ${index.pos.size} jobs, ${index.companies.length} companies, ${index.cities.length} cities, +${mb() - before} MB`)

  const queries = [
    { q: 'vp finance' },
    { q: 'product manager', loc: 'metro:NY' },
    { q: 'FP&A', remote: 'remote' },
    { q: '"chief of staff"' },
    { q: 'company:"JPMorgan Chase"' },
    { q: 'software engineer', loc: 'Austin, TX', sort: 'newest' },
    { loc: 'Texas', remote: 'hybrid' },
    { q: 'director healthcare', sort: 'pay' },
    { q: 'zzqx nothing' },
  ]
  const c = members[0]
  for (const [i, raw] of queries.entries()) {
    const params = parseBoardSearchParams(raw)
    for (const pass of ['first', 'warm']) {
      const h0 = mb()
      t = performance.now()
      const s = await buildBoardSearch(params)
      const r = await loadBoardShortlist({
        ...baseOpts(c),
        relevance: s?.relevance,
        sort: params.sort === 'best' ? undefined : params.sort,
        perCompany: s && s.parsed.companies.length > 0 ? 300 : undefined,
      })
      const took = ms(t)
      if (pass === 'warm' || i === 0)
        console.log(`${pass.padEnd(5)} ${JSON.stringify(raw).padEnd(60)} ${String(r.openTotal + r.lockedTotal).padStart(6)} results  ${took}${i === 0 && pass === 'first' ? ` (fills the normalize memos, +${mb() - h0} MB)` : ''}  top: ${r.open.slice(0, 3).map((p) => `${p.title} @ ${p.companyName}`).join(' | ')}`)
    }
  }
  // In-memory time only (no 300-row DB read): match + rank over the whole live board.
  const { rankBoardRows, liveBoardWhere } = await import('@/lib/jobs/board-shortlist')
  const { findLightRows } = await import('@/lib/jobs/board-light-rows')
  const rows = (await findLightRows(liveBoardWhere())).sort((a, b) => (a.id < b.id ? -1 : 1))
  const cand = { ...c }
  const time = (f: () => unknown, reps = 3) => {
    f()
    const t0 = performance.now()
    for (let k = 0; k < reps; k++) f()
    return Math.round((performance.now() - t0) / reps)
  }
  console.log(`in-memory over ${rows.length} rows (warm, avg of 3):`)
  console.log(`  rank, no search: ${time(() => rankBoardRows(rows, { candidate: cand, isCandidatePlus: true }))} ms`)
  for (const raw of queries) {
    const params = parseBoardSearchParams(raw)
    const s = (await buildBoardSearch(params))!
    const matchMs = time(() => rows.forEach((r) => s.relevance(r)))
    const rankMs = time(() => rankBoardRows(rows, { candidate: cand, isCandidatePlus: true, relevance: s.relevance, sort: params.sort === 'best' ? undefined : params.sort }))
    console.log(`  ${JSON.stringify(raw).padEnd(60)} match ${matchMs} ms, match+rank ${rankMs} ms`)
  }
  console.log(`heap at end ${mb()} MB`)
  await prisma.$disconnect()
}
function parseNoSearch() {
  return { relevance: undefined, sort: undefined, perCompany: undefined }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
