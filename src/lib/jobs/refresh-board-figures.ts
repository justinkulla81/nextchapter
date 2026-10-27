import 'server-only'
import { writeBoardFigure, type BoardFigureKey } from '@/lib/jobs/stored-board-figures'
import { buildEmployerRankings, buildFunctionRankings } from '@/lib/seo/employer-rankings'
import { jobCounts } from '@/lib/marketing/workforce-numbers'
import { buildExposureRows } from '@/lib/skills/ai-exposure-server'

// The whole-board scans (10-17 s each over ~650k live postings), run one at a time instead of on public pages:
// top employers, the workforce page counts, and the jobs-by-AI-exposure split. A step that fails keeps its
// previous row, so a stale figure is never replaced by a broken one.
const STEPS: readonly (readonly [BoardFigureKey, () => Promise<unknown>])[] = [
  ['employer-rankings', buildEmployerRankings],
  ['function-rankings', buildFunctionRankings],
  ['workforce-jobs', jobCounts],
  ['exposure-rows', buildExposureRows],
]

export async function refreshBoardFigures(): Promise<{ done: Record<string, number>; failed: string[] }> {
  const done: Record<string, number> = {}
  const failed: string[] = []
  for (const [key, build] of STEPS) {
    const started = Date.now()
    try {
      await writeBoardFigure(key, await build())
      done[key] = Date.now() - started
    } catch (error) {
      console.error('board figure failed:', key, error)
      failed.push(key)
    }
  }
  return { done, failed }
}
