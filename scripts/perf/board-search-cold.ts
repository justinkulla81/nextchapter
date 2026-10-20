// Board search: cold vs warm latency of a member's search, end to end in one
// server instance (the shortlist plus the search). Read-only. Run each mode in a
// fresh process, since "cold" means a new instance:
//
//   set -a; . ./.env.local; set +a
//   node --expose-gc --conditions=react-server --import tsx scripts/perf/board-search-cold.ts search-first
//   node --expose-gc --conditions=react-server --import tsx scripts/perf/board-search-cold.ts board-then-search
//
// search-first:       the instance's first request is a search (nothing loaded yet).
// board-then-search:  the member opens the board (no search), then searches right away
//                     — what the board page's background index warm-up is for.
import { prisma } from '@/lib/prisma'
import { loadBoardShortlist } from '@/lib/jobs/board-shortlist'
import * as searchIndex from '@/lib/jobs/board-search-index'
import { parseBoardSearchParams } from '@/lib/jobs/board-search'
import { memberStageWindow } from '@/lib/jobs/career-stage'
import { defaultWorkTypes } from '@/lib/jobs/work-type'

const mb = () => {
  ;(globalThis as { gc?: () => void }).gc?.()
  return Math.round(process.memoryUsage().heapUsed / 1e6)
}
const rss = () => Math.round(process.memoryUsage().rss / 1e6)

async function main() {
  const mode = process.argv[2] ?? 'search-first'
  const [c] = await prisma.candidateProfile.findMany({ where: { isSampleData: false }, orderBy: { createdAt: 'desc' }, take: 1 })
  const opts = {
    candidate: c,
    isCandidatePlus: true,
    where: {},
    stageWindow: memberStageWindow(c),
    includeMidLevel: true,
    includeEarlyCareer: true,
    workTypes: defaultWorkTypes(c),
  }
  const search = async (raw: Record<string, string>) => {
    const params = parseBoardSearchParams(raw)
    const t = performance.now()
    const s = await searchIndex.buildBoardSearch(params)
    const r = await loadBoardShortlist({ ...opts, relevance: s?.relevance, sort: params.sort === 'best' ? undefined : params.sort })
    const took = Math.round(performance.now() - t)
    // What the board page does once its shortlist is in (absent before the warm-up change).
    void (searchIndex as { warmSearchIndex?: () => Promise<unknown> }).warmSearchIndex?.()
    const full = (s as { indexReady?: boolean } | null)?.indexReady
    console.log(`  search ${JSON.stringify(raw).padEnd(42)} ${String(took).padStart(6)} ms  ${r.openTotal + r.lockedTotal} results${full === undefined ? '' : full ? ' (full index)' : ' (fast path: light fields)'}`)
    return took
  }
  const heap0 = mb()
  console.log(`mode ${mode}; heap ${heap0} MB, rss ${rss()} MB`)
  if (mode === 'board-then-search') {
    const t = performance.now()
    await loadBoardShortlist(opts)
    console.log(`  board, no search (cold)                         ${String(Math.round(performance.now() - t)).padStart(6)} ms`)
    // What the board page does after the shortlist loads (absent before this change).
    const warm = (searchIndex as { warmSearchIndex?: () => Promise<unknown> }).warmSearchIndex
    if (warm) void warm()
  }
  await search({ q: 'vp finance' })
  await search({ q: 'product manager', loc: 'metro:NY' })
  const heapBeforeIndex = mb()
  const tIndex = performance.now()
  const index = await searchIndex.loadSearchIndex()
  console.log(`  (index ready ${Math.round(performance.now() - tIndex)} ms later; ${index.pos.size} jobs; heap now ${mb()} MB vs ${heapBeforeIndex} MB before awaiting)`)
  await search({ q: 'vp finance' })
  await search({ q: 'FP&A', remote: 'remote' })
  await search({ q: 'director healthcare', sort: 'pay' })
  console.log(`end: heap ${mb()} MB (+${mb() - heap0} MB over start), rss ${rss()} MB`)
  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
