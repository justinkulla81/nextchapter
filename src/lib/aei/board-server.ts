import 'server-only'
import { loadJobSocs } from '@/lib/jobs/search-breadth-server'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { aeiSocFor, aiExposureView, EXPOSURE_RANK, lookupOccupation, type AeiSocSource, type AiExposureView } from '@/lib/aei/job-exposure'
import { loadAeiOccupations, type AeiOccupationRow } from '@/lib/aei/server'

// The job board's AI exposure (Anthropic Economic Index): the sort's per-row rank and each shown
// job's drawer view. Both read the job's occupation the same way the stored aiExposureLevel was
// set (aeiSocFor), so the sort, the badge and the drawer always agree.

type RankRow = { id: string; title: string; targetFunction: string | null; level: string | null }

const rankMemo = new WeakMap<Map<string, AeiOccupationRow>, WeakMap<object, number>>()

/**
 * Per-row exposure rank for the board's "Most / Least exposed to AI" sorts: 3 High, 2 Medium,
 * 1 Low, 0 no AEI data. Null when the AEI table can't be read (the sorts then fall back to fit).
 */
export async function loadExposureRank(): Promise<((p: RankRow) => number) | null> {
  const [occ, jobs] = await Promise.all([loadAeiOccupations(), loadJobSocs()])
  if (occ.size === 0) return null
  let memo = rankMemo.get(occ)
  if (!memo) rankMemo.set(occ, (memo = new WeakMap()))
  const m = memo
  return (p) => {
    const hit = m.get(p)
    if (hit !== undefined) return hit
    const { soc } = aeiSocFor({ socCode: jobs.socs.get(p.id) ?? null, title: p.title, fn: p.targetFunction ?? inferFunctionFromTitle(p.title), level: p.level })
    const row = lookupOccupation(occ, soc)
    const rank = row ? EXPOSURE_RANK[row.exposureLevel] : 0
    m.set(p, rank)
    return rank
  }
}

type ViewPosting = { title: string; socCode: string | null; targetFunction: string | null; level: string | null; aeiSocCode: string | null; aeiSocSource: string | null }

/** The drawer's AI exposure for one job, or null when its occupation has no AEI data. */
export function exposureViewFor(occ: Map<string, AeiOccupationRow>, p: ViewPosting): AiExposureView | null {
  const stored = p.aeiSocCode && (p.aeiSocSource === 'title' || p.aeiSocSource === 'function' || p.aeiSocSource === 'default')
  const { soc, source } = stored
    ? { soc: p.aeiSocCode!, source: p.aeiSocSource as AeiSocSource }
    : aeiSocFor({ socCode: p.socCode, title: p.title, fn: p.targetFunction ?? inferFunctionFromTitle(p.title), level: p.level })
  const row = lookupOccupation(occ, soc)
  return row ? aiExposureView(row, source) : null
}
