/**
 * Re-read every stored 8-K likely-opening signal with the Claude Haiku pass
 * (src/lib/likely-openings/llm-read.ts) and re-check stored Form D rows
 * against the tightened fund-name rules. Updates rows in place (same id when
 * the signal type survives), deletes dropped ones, adds new ones.
 *
 * Haiku reads are cached per accession number in SecFilingRead and, always,
 * in a local JSON file (--cache-file), so a re-run never re-bills — and
 * reads made before the SecFilingRead table exists can be loaded into it later
 * by re-running with the same file.
 *
 * Usage:
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/reparse-likely-openings.ts \
 *     [--dry-run] [--cache-file path.json] [--report path.json] [--limit N]
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { prisma } from '../src/lib/prisma'
import { getAnthropicClient } from '../src/lib/anthropic'
import { secFetch } from '../src/lib/likely-openings/edgar'
import { htmlToText, extractItem502, readItem502, type ExecSignalDraft } from '../src/lib/likely-openings/parse-8k'
import { looksLikeVehicleName, isExcludedIndustry } from '../src/lib/likely-openings/parse-form-d'
import { dbFilingReadCache } from '../src/lib/likely-openings/read-cache'
import {
  execSignalsWithLlm,
  emptyLlmStats,
  usageCostUsd,
  type CachedFilingRead,
  type FilingReadCache,
} from '../src/lib/likely-openings/llm-read'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const DRY_RUN = process.argv.includes('--dry-run')
const CACHE_FILE = arg('--cache-file') ?? join(tmpdir(), 'sec-filing-reads.json')
const REPORT_FILE = arg('--report')
const LIMIT = Number(arg('--limit')) || Infinity
const CONCURRENCY = 6

// File cache first, SecFilingRead second (missing table is fine).
function layeredCache(): FilingReadCache & { flush(): void } {
  const file: Record<string, CachedFilingRead> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}
  let dbOk = true
  return {
    async get(acc) {
      if (file[acc]) {
        if (dbOk && !DRY_RUN) await dbFilingReadCache.set(acc, file[acc]).catch(() => (dbOk = false))
        return file[acc]
      }
      if (!dbOk) return null
      try {
        return await dbFilingReadCache.get(acc)
      } catch {
        dbOk = false
        return null
      }
    },
    async set(acc, entry) {
      file[acc] = entry
      if (dbOk && !DRY_RUN) await dbFilingReadCache.set(acc, entry).catch(() => (dbOk = false))
    },
    flush() {
      writeFileSync(CACHE_FILE, JSON.stringify(file))
    },
  }
}

async function primaryDocUrl(indexUrl: string): Promise<string | null> {
  const html = await secFetch(indexUrl)
  const m = html.match(/href="(?:\/ix\?doc=)?(\/Archives\/edgar\/data\/[^"]+\.html?)"/i)
  return m ? `https://www.sec.gov${m[1]}` : null
}

type Stored = Awaited<ReturnType<typeof loadExec>>[number]
function loadExec() {
  return prisma.likelyOpening.findMany({ where: { signalType: { in: ['EXEC_DEPARTURE', 'EXEC_APPOINTMENT'] } }, orderBy: { filingDate: 'desc' } })
}

interface Change {
  accessionNumber: string
  companyName: string
  before: { signalType: string; roles: string[]; summary: string }[]
  after: ExecSignalDraft[]
  source: string
}

async function main() {
  const started = Date.now()
  const cache = layeredCache()
  const stats = emptyLlmStats()
  const rows = await loadExec()
  const byAcc = new Map<string, Stored[]>()
  for (const r of rows) byAcc.set(r.accessionNumber, [...(byAcc.get(r.accessionNumber) ?? []), r])
  const accessions = [...byAcc.keys()].slice(0, LIMIT)
  const before = { EXEC_DEPARTURE: 0, EXEC_APPOINTMENT: 0 }
  const after = { EXEC_DEPARTURE: 0, EXEC_APPOINTMENT: 0 }
  const changes: Change[] = []
  let fetchErrors = 0
  let done = 0

  async function one(acc: string) {
    const existing = byAcc.get(acc)!
    for (const r of existing) before[r.signalType as keyof typeof before]++
    const base = existing[0]
    let signals: ExecSignalDraft[] | null = null
    let source = 'rules'
    try {
      const doc = await primaryDocUrl(base.filingUrl)
      const section = doc ? extractItem502(htmlToText(await secFetch(doc))) : null
      if (section) {
        const res = await execSignalsWithLlm({
          accessionNumber: acc,
          companyName: base.companyName,
          section,
          rules: readItem502(section),
          cache,
          client: getAnthropicClient,
          stats,
          log: (m) => console.log(m),
        })
        signals = res.signals
        source = res.source
      }
    } catch (e) {
      console.log(`${acc} fetch failed: ${e instanceof Error ? e.message : e}`)
    }
    if (!signals) {
      fetchErrors++
      for (const r of existing) after[r.signalType as keyof typeof after]++
      return
    }
    for (const s of signals) after[s.signalType]++
    const same =
      signals.length === existing.length &&
      signals.every((s) => existing.some((r) => r.signalType === s.signalType && r.summary === s.summary && [...r.roles].sort().join() === [...s.roles].sort().join()))
    if (same) return
    changes.push({
      accessionNumber: acc,
      companyName: base.companyName,
      before: existing.map((r) => ({ signalType: r.signalType, roles: r.roles, summary: r.summary })),
      after: signals,
      source,
    })
    if (DRY_RUN) return
    // Batch (non-interactive) transaction: safe through pgbouncer.
    const ops = []
    for (const r of existing) {
      const s = signals.find((x) => x.signalType === r.signalType)
      ops.push(
        s
          ? prisma.likelyOpening.update({ where: { id: r.id }, data: { roles: s.roles, summary: s.summary } })
          : prisma.likelyOpening.delete({ where: { id: r.id } })
      )
    }
    for (const s of signals) {
      if (existing.some((r) => r.signalType === s.signalType)) continue
      const { id: _id, createdAt: _c, signalType: _t, roles: _r, summary: _s, ...rest } = base
      ops.push(prisma.likelyOpening.create({ data: { ...rest, signalType: s.signalType, roles: s.roles, summary: s.summary } }))
    }
    await prisma.$transaction(ops)
  }

  const queue = [...accessions]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let acc = queue.shift(); acc; acc = queue.shift()) {
        await one(acc)
        if (++done % 10 === 0) {
          cache.flush()
          console.log(`${done}/${accessions.length} — calls ${stats.llmCalls}, cache ${stats.llmCacheHits}, changed ${changes.length}`)
        }
      }
    })
  )
  cache.flush()

  // ---- Form D: tightened fund-name / industry rules --------------------
  const funding = await prisma.likelyOpening.findMany({ where: { signalType: 'FUNDING_RAISE' }, select: { id: true, companyName: true, industry: true } })
  const fundLike = funding.filter((f) => looksLikeVehicleName(f.companyName) || isExcludedIndustry(f.industry))
  if (!DRY_RUN && fundLike.length) await prisma.likelyOpening.deleteMany({ where: { id: { in: fundLike.map((f) => f.id) } } })

  const cost = usageCostUsd(stats.inputTokens, stats.outputTokens)
  const summary = {
    dryRun: DRY_RUN,
    filings: accessions.length,
    before: { ...before, FUNDING_RAISE: funding.length },
    after: { ...after, FUNDING_RAISE: funding.length - fundLike.length },
    filingsChanged: changes.length,
    fetchErrors,
    llm: stats,
    estimatedCostUsd: Number(cost.toFixed(4)),
    formDDropped: fundLike.map((f) => `${f.companyName} (${f.industry})`),
    seconds: Math.round((Date.now() - started) / 1000),
  }
  console.log(JSON.stringify(summary, null, 2))
  if (REPORT_FILE) writeFileSync(REPORT_FILE, JSON.stringify({ summary, changes }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
