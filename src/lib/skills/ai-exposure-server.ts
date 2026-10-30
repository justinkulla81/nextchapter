import 'server-only'
import { prisma } from '@/lib/prisma'
import { readBoardFigure } from '@/lib/jobs/stored-board-figures'
import { resolveCandidateOccupation } from '@/lib/careers/candidate-occupation'
import { exposureFor, summarizeJobsByExposure, type ExposureMap, type JobsByExposure, type OccupationExposure } from '@/lib/skills/ai-exposure'

// Server loaders for the Anthropic Economic Index exposure (src/lib/skills/ai-exposure.ts). Every loader fails soft:
// a database error returns nothing, and the page hides the exposure line instead of showing a wrong number.

const MAP_TTL_MS = 6 * 60 * 60 * 1000
let mapMemo: { at: number; value: Promise<ExposureMap> } | null = null

/** The whole table (756 occupations) as a map keyed by 6-digit SOC. Empty when the table cannot be read. */
export function loadExposureMap(): Promise<ExposureMap> {
  const now = Date.now()
  if (!mapMemo || now - mapMemo.at > MAP_TTL_MS) {
    const at = now
    const value = prisma.occupationAiExposure
      .findMany({ select: { soc6: true, title: true, observedExposure: true } })
      .then((rows) => new Map(rows.map((r) => [r.soc6, { title: r.title, score: r.observedExposure }])) as ExposureMap)
      .catch((error) => {
        console.error('AI exposure unavailable:', error)
        if (mapMemo?.at === at) mapMemo = null
        return new Map() as ExposureMap
      })
    mapMemo = { at, value }
  }
  return mapMemo.value
}

/** The exposure for one O*NET-SOC or 6-digit code, or null when it is not measured. */
export async function loadExposureForSoc(socCode: string | null | undefined): Promise<OccupationExposure | null> {
  return exposureFor(socCode, await loadExposureMap())
}

/** The exposure for a member's occupation (their saved choice, or the match from their résumé title). Null when unresolved or not measured. */
export async function loadCandidateExposure(candidateId: string): Promise<(OccupationExposure & { socCode: string }) | null> {
  try {
    const occ = await resolveCandidateOccupation(candidateId)
    if (occ.status !== 'resolved') return null
    const e = exposureFor(occ.socCode, await loadExposureMap())
    return e ? { ...e, socCode: occ.socCode } : null
  } catch (error) {
    console.error('Candidate AI exposure unavailable:', error)
    return null
  }
}

const SPLIT_TTL_MS = 30 * 60 * 1000
const SPLIT_MAX_ENTRIES = 200
const splitMemo = new Map<string, { at: number; value: Promise<JobsByExposure | null> }>()

/** Open postings counted by job function and 6-digit occupation: one row per pair. Null where the posting has no function or occupation. */
export interface ExposureRow {
  fn: string | null
  soc6: string | null
  count: number
}

/** One pass over the approved, unexpired board (10 s or more). Run by the cron /api/cron/board-figures, not by a page. */
export async function buildExposureRows(): Promise<ExposureRow[]> {
  const rows = await prisma.$queryRaw<{ fn: string | null; soc6: string | null; count: bigint }[]>`
    SELECT "targetFunction" AS fn, left("socCode", 7) AS soc6, count(*)::bigint AS count FROM "ExclusiveJobPosting"
    WHERE status = 'approved' AND ("expiresAt" IS NULL OR "expiresAt" > now())
    GROUP BY 1, 2`
  return rows.map((r) => ({ fn: r.fn, soc6: r.soc6, count: Number(r.count) }))
}

/** The stored rows (BoardFigure, refreshed by the cron); the live pass only when none is stored yet. */
async function loadExposureRows(): Promise<ExposureRow[]> {
  return (await readBoardFigure<ExposureRow[]>('exposure-rows')) ?? buildExposureRows()
}

/** Live openings per 6-digit occupation, from the stored board figure only: never the live scan, so a page can call it. Empty when none is stored. */
export async function loadOpeningsBySoc(): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  try {
    for (const r of (await readBoardFigure<ExposureRow[]>('exposure-rows')) ?? []) if (r.soc6) out.set(r.soc6, (out.get(r.soc6) ?? 0) + r.count)
  } catch (error) {
    console.error('Openings by occupation unavailable:', error)
  }
  return out
}

/**
 * The approved, unexpired openings split by the exposure of the occupation each one is placed in. `fn` limits it to one
 * job function (the label the board already uses); omit it for every opening. Postings without an occupation, or whose
 * occupation has no score, are counted in `total` but not in the split, so the page can say how much it covers.
 */
export function loadJobsByExposure(fn?: string | null): Promise<JobsByExposure | null> {
  const key = fn ?? '*'
  const now = Date.now()
  const hit = splitMemo.get(key)
  if (hit && now - hit.at <= SPLIT_TTL_MS) return hit.value
  const at = now
  const value = (async () => {
    const [map, all] = await Promise.all([loadExposureMap(), loadExposureRows()])
    if (!map.size) return null
    const bySoc = new Map<string | null, number>()
    for (const r of all) if (!fn || r.fn === fn) bySoc.set(r.soc6, (bySoc.get(r.soc6) ?? 0) + r.count)
    const split = summarizeJobsByExposure(Array.from(bySoc, ([soc6, count]) => ({ soc6, count })), map)
    return split.measured ? split : null
  })().catch((error) => {
    console.error('Jobs by AI exposure unavailable:', error)
    splitMemo.delete(key)
    return null
  })
  if (splitMemo.size >= SPLIT_MAX_ENTRIES) splitMemo.delete(splitMemo.keys().next().value as string)
  splitMemo.set(key, { at, value })
  return value
}
