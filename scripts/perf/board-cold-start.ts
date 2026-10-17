// Board cold start: what a fresh server instance pays for a member's first board
// view (no search), and where it goes. Read-only. One mode per fresh process, since
// "cold" means a new instance:
//
//   set -a; . ./.env.local; set +a
//   node --expose-gc --conditions=react-server --import tsx scripts/perf/board-cold-start.ts <mode> [memberOffset]
//
// full:    the board page's loadBoardShortlist call cold, then warm twice (wall + CPU).
//          The first run under a new BOARD_SNAPSHOT_BUILD reads the database and writes
//          the board snapshot (board-snapshot.ts); the next run starts from it.
// inputs:  each cold-start input on its own, in order: board version, snapshot parts,
//          job occupations, similarity, taxonomy, title index, place coordinates.
// cpu:     the database read path step by step (read + decode, filter, occupations,
//          classifier, ranking cold / warm / a second member), wall and CPU.
// phases:  the database reads alone, timed.
// PROFILE_STEP=<step label prefix> prints a CPU profile of that step (top self time).
import { prisma } from '@/lib/prisma'
import { loadBoardShortlist, liveBoardWhere, boardLevelWindowWhere } from '@/lib/jobs/board-shortlist'
import { memberStageWindow, ALL_STAGES_WINDOW, EARLY_CAREER_RUNGS } from '@/lib/jobs/career-stage'
import { defaultWorkTypes } from '@/lib/jobs/work-type'
import { boardBreadthFor } from '@/lib/jobs/search-breadth'

const rss = () => Math.round(process.memoryUsage().rss / 1e6)
const t0 = () => performance.now()
const since = (t: number) => Math.round(performance.now() - t)

async function member(offset: number) {
  // MEMBER_ID=<id suffix>: that member instead of the offset-th newest with a function.
  const suffix = process.env.MEMBER_ID
  const [c] = suffix
    ? await prisma.candidateProfile.findMany({ where: { isSampleData: false, id: { endsWith: suffix } }, take: 1 })
    : await prisma.candidateProfile.findMany({ where: { isSampleData: false, primaryFunction: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, skip: offset })
  // subFunction undefined: never write the re-derived sub-function back (read-only run).
  return { ...c, subFunction: undefined } as unknown as typeof c
}

export function boardPageOpts(c: Awaited<ReturnType<typeof member>>) {
  return {
    candidate: c,
    isCandidatePlus: true,
    where: {},
    stageWindow: memberStageWindow(c),
    seniorityRing: true,
    includeMidLevel: true,
    includeEarlyCareer: true,
    workTypes: defaultWorkTypes(c),
    breadth: boardBreadthFor(c),
  } as Parameters<typeof loadBoardShortlist>[0]
}

async function full(offset: number) {
  const c = await member(offset)
  await prisma.$queryRaw`SELECT 1` // connection up, not counted
  for (const label of ['cold', 'warm', 'warm']) {
    const prof = process.env.PROFILE_STEP === label ? await startProfile() : null
    const cpu = process.cpuUsage()
    const t = t0()
    const r = await loadBoardShortlist(boardPageOpts(c))
    const used = process.cpuUsage(cpu)
    console.log(`${label.padEnd(5)} ${String(since(t)).padStart(6)} ms  cpu ${Math.round((used.user + used.system) / 1000)} ms  open ${r.open.length}/${r.openTotal}  rss ${rss()} MB`)
    if (prof) await prof(label)
  }
}

async function phases() {
  await prisma.$queryRaw`SELECT 1`
  const { getClosedPostingCounts } = await import('@/lib/jobs/ghost-risk-data')
  const { findLightRowsPage } = await import('@/lib/jobs/board-light-rows')
  const sb = await import('@/lib/jobs/search-breadth-server')
  const { getTaxonomy } = await import('@/lib/careers/taxonomy')
  let t = t0()
  const closed = await getClosedPostingCounts()
  console.log(`closed posting counts        ${since(t)} ms (${closed.size})`)
  t = t0()
  let n = 0
  let after: string | null = null
  const where = liveBoardWhere(boardLevelWindowWhere(undefined, { window: ALL_STAGES_WINDOW, includeMidLevel: true, includeEarlyCareer: true }))
  for (;;) {
    const page = await findLightRowsPage(where, after, 20_000)
    n += page.length
    if (page.length < 20_000) break
    after = page[page.length - 1].id
  }
  console.log(`light rows, every level      ${since(t)} ms (${n} rows)`)
  t = t0()
  const socs = await sb.loadJobSocs()
  console.log(`job occupations              ${since(t)} ms (${socs.socs.size} socs, ${socs.skillIds.size} skillIds)`)
  t = t0()
  await sb.loadSimilarityIndex()
  console.log(`occupation similarity        ${since(t)} ms`)
  t = t0()
  await sb.loadPlaceCoords()
  console.log(`place coords                 ${since(t)} ms`)
  t = t0()
  await getTaxonomy()
  console.log(`taxonomy                     ${since(t)} ms`)
  void EARLY_CAREER_RUNGS
}

// Wall and CPU (this process: query decoding + in-memory work) of one step.
async function step<T>(label: string, f: () => Promise<T> | T): Promise<T> {
  const prof = process.env.PROFILE_STEP && label.startsWith(process.env.PROFILE_STEP) ? await startProfile() : null
  const c = process.cpuUsage()
  const t = t0()
  const out = await f()
  const cpu = process.cpuUsage(c)
  if (prof) await prof(label)
  console.log(`${label.padEnd(44)} wall ${String(since(t)).padStart(6)} ms   cpu ${String(Math.round((cpu.user + cpu.system) / 1000)).padStart(6)} ms   rss ${rss()} MB`)
  return out
}

// PROFILE_STEP=<label prefix>: a CPU profile of that step, top functions by self time.
async function startProfile(): Promise<(label: string) => Promise<void>> {
  const { Session } = await import('node:inspector/promises')
  const session = new Session()
  session.connect()
  await session.post('Profiler.enable')
  await session.post('Profiler.setSamplingInterval', { interval: 500 })
  await session.post('Profiler.start')
  return async (label) => {
    const { profile } = (await session.post('Profiler.stop')) as { profile: { nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number } }[]; samples: number[]; timeDeltas: number[] } }
    const byId = new Map(profile.nodes.map((n) => [n.id, n]))
    const self = new Map<string, number>()
    profile.samples.forEach((id, i) => {
      const cf = byId.get(id)!.callFrame
      const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber}`
      self.set(k, (self.get(k) ?? 0) + profile.timeDeltas[i] / 1000)
    })
    console.log(`profile: ${label}`)
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${Math.round(v).toString().padStart(6)} ms  ${k}`)
    session.disconnect()
  }
}

// Each input on its own, one after another (so no read competes with another for the
// network), then the in-memory work on them, cold and warm. CPU is what this process
// spent; on a server next to the database the reads cost about that plus server time.
async function cpuPhases(offset: number) {
  await prisma.$queryRaw`SELECT 1`
  const c = await member(offset)
  const c2 = await member(offset + 1)
  const { getClosedPostingCounts } = await import('@/lib/jobs/ghost-risk-data')
  const { findLightRowsPage } = await import('@/lib/jobs/board-light-rows')
  const sb = await import('@/lib/jobs/search-breadth-server')
  const { rankBoardRows } = await import('@/lib/jobs/board-shortlist')
  const { classifyLocation } = await import('@/lib/jobs/us-location')
  const { ghostRisk, repostKey } = await import('@/lib/jobs/ghost-risk')
  const { isInternshipJob } = await import('@/lib/jobs/work-type')
  const closed = await step('closed posting counts', () => getClosedPostingCounts())
  const where = liveBoardWhere(boardLevelWindowWhere(undefined, { window: { lo: 0, hi: 99 }, includeMidLevel: true, includeEarlyCareer: true }))
  const raw = await step('light rows, all levels (read + decode)', async () => {
    const out = []
    let after: string | null = null
    for (;;) {
      const page = await findLightRowsPage(where, after, 20_000)
      out.push(...page)
      if (page.length < 20_000) break
      after = page[page.length - 1].id
    }
    return out
  })
  const rows = await step(`keepRelevant (${raw.length} rows)`, () => {
    const now = Date.now()
    return raw.filter((p) => {
      if (isInternshipJob(p)) return false
      if (classifyLocation(p.location) === 'non_us') return false
      return ghostRisk({ priorClosedCount: closed.get(repostKey(p.companyName, p.title, p.location)) ?? 0, ageDays: (now - p.createdAt.getTime()) / 86_400_000 }).level !== 'likely'
    })
  })
  await step('job occupations (read + decode)', () => sb.loadJobSocs())
  const cls = await step('member classifier (similarity, taxonomy, places)', () => sb.loadBreadthClassifier(c))
  const rank = (cand: typeof c, k: typeof cls) =>
    rankBoardRows(rows, { ...boardPageOpts(cand), place: k?.place, breadth: (boardPageOpts(cand).breadth as 'narrow' | 'wide') })
  await step(`rank, cold rows (${rows.length})`, () => rank(c, cls))
  await step('rank, warm rows, same member', () => rank(c, cls))
  const cls2 = await step('member 2 classifier', () => sb.loadBreadthClassifier(c2))
  await step('rank, warm rows, member 2', () => rank(c2, cls2))
}

// Each cold-start input on its own (sequential, so none competes for the network), wall and CPU.
async function inputs() {
  await prisma.$queryRaw`SELECT 1`
  const sb = await import('@/lib/jobs/search-breadth-server')
  const tax = await import('@/lib/careers/taxonomy')
  const snap = await import('@/lib/jobs/board-snapshot')
  await step('board version (fingerprint)', () => snap.boardFingerprint())
  const m = await step('board snapshot manifest', () => snap.readManifest('board-core'))
  const parts = await step('board snapshot parts (download + gunzip + parse)', () => snap.readParts(m!))
  const { decodeBoardPart } = await import('@/lib/jobs/board-snapshot-codec')
  await step('board snapshot decode to rows', () => { const pool = new Map(); for (const p of parts!) decodeBoardPart(p, pool) })
  await step('job occupations (snapshot)', () => sb.loadJobSocs())
  await step('occupation similarity', () => sb.loadSimilarityIndex())
  await step('taxonomy', () => tax.getTaxonomy())
  await step('title index', () => tax.getTitleIndex())
  await step('place coords', () => sb.loadPlaceCoords())
}

async function main() {
  const mode = process.argv[2] ?? 'full'
  if (mode === 'full') await full(Number(process.argv[3] ?? 0))
  else if (mode === 'inputs') await inputs()
  else if (mode === 'cpu') await cpuPhases(Number(process.argv[3] ?? 0))
  else await phases()
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
