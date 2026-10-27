import 'server-only'
import { replaceBoardFigures, writeBoardFigure, type BoardFigureKey } from '@/lib/jobs/stored-board-figures'
import { buildEmployerRankings, buildFunctionRankings } from '@/lib/seo/employer-rankings'
import { jobCounts } from '@/lib/marketing/workforce-numbers'
import { buildExposureRows } from '@/lib/skills/ai-exposure-server'
import { loadJobAggregate } from '@/lib/places/places'
import { buildTitleFigures } from '@/lib/seo/job-titles'

// The whole-board scans (10-65 s each over ~650k live postings), run one at a time instead of on public pages:
// top employers, the workforce page counts, the jobs-by-AI-exposure split, the place job counts and the job-title
// pay pages. A step that fails keeps its previous rows, so a stale figure is never replaced by a broken one.
const single = (key: BoardFigureKey, build: () => Promise<unknown>) => async () => writeBoardFigure(key, await build())

/** One scan feeds the title list, the job-type summaries and one row per title page. */
async function refreshTitleFigures() {
  const { stats, types, parts } = await buildTitleFigures()
  await writeBoardFigure('job-title-stats', stats)
  await writeBoardFigure('job-type-summaries', types)
  await replaceBoardFigures('job-title:', stats.flatMap((t) => (parts.has(t.slug) ? [[`job-title:${t.slug}`, parts.get(t.slug)] as [BoardFigureKey, unknown]] : [])))
}

const STEPS: readonly (readonly [string, () => Promise<void>])[] = [
  ['employer-rankings', single('employer-rankings', buildEmployerRankings)],
  ['function-rankings', single('function-rankings', buildFunctionRankings)],
  ['workforce-jobs', single('workforce-jobs', jobCounts)],
  ['exposure-rows', single('exposure-rows', buildExposureRows)],
  ['places-job-aggregate', single('places-job-aggregate', loadJobAggregate)],
  ['job-titles', refreshTitleFigures],
]

export async function refreshBoardFigures(): Promise<{ done: Record<string, number>; failed: string[] }> {
  const done: Record<string, number> = {}
  const failed: string[] = []
  for (const [name, run] of STEPS) {
    const started = Date.now()
    try {
      await run()
      done[name] = Date.now() - started
    } catch (error) {
      console.error('board figure failed:', name, error)
      failed.push(name)
    }
  }
  return { done, failed }
}
