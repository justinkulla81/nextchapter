import 'server-only'
import { replaceBoardFigures, writeBoardFigure, type BoardFigureKey } from '@/lib/jobs/stored-board-figures'
import { buildEmployerRankings, buildFunctionRankings } from '@/lib/seo/employer-rankings'
import { jobCounts } from '@/lib/marketing/workforce-numbers'
import { buildExposureRows } from '@/lib/skills/ai-exposure-server'
import { loadJobAggregate } from '@/lib/places/places'
import { buildTitleFigures } from '@/lib/seo/job-titles'
import { placeIndex } from '@/lib/seo/job-title-places'
import { buildEntryFigures } from '@/lib/entry-roles/live'
import { buildRoleFigures } from '@/lib/seo/role-figures'
import { buildOrgJobStats } from '@/lib/seo/org-pages'

// The whole-board scans (10-65 s each over ~650k live postings), run one at a time instead of on public pages:
// top employers, the workforce page counts, the jobs-by-AI-exposure split, the place job counts and the job-title
// pay pages. A step that fails keeps its previous rows, so a stale figure is never replaced by a broken one.
const single = (key: BoardFigureKey, build: () => Promise<unknown>) => async () => writeBoardFigure(key, await build())

/** One scan feeds the title list, the job-type summaries and one row per title page. */
async function refreshTitleFigures() {
  const { stats, types, parts, places } = await buildTitleFigures()
  await writeBoardFigure('job-title-stats', stats)
  await writeBoardFigure('job-type-summaries', types)
  await replaceBoardFigures('job-title:', stats.flatMap((t) => (parts.has(t.slug) ? [[`job-title:${t.slug}`, parts.get(t.slug)] as [BoardFigureKey, unknown]] : [])))
  // One row per (title, place) page. The prefix is `job-title-place:`, which `job-title:` does not match, so neither pass removes the other's rows.
  await replaceBoardFigures('job-title-place:', places.map((p) => [`job-title-place:${p.titleSlug}:${p.key}`, p] as [BoardFigureKey, unknown]))
  await writeBoardFigure('job-title-places-index', placeIndex(places))
}

/** The entry-level role pages: a stats list, one row per role and one per (role, place) page. */
async function refreshEntryRoleFigures() {
  const { details, places, index } = await buildEntryFigures()
  await writeBoardFigure('entry-role-stats', details.map(({ jobIds: _ids, states: _s, topEmployers: _e, ...stat }) => stat))
  await replaceBoardFigures('entry-role:', details.map((d) => [`entry-role:${d.slug}`, d] as [BoardFigureKey, unknown]))
  await replaceBoardFigures('entry-role-place:', places.map((p) => [`entry-role-place:${p.titleSlug}:${p.key}`, p] as [BoardFigureKey, unknown]))
  await writeBoardFigure('entry-role-places-index', index)
}

/** One scan feeds the role index and one row per role page (/roles/<role>). */
async function refreshRoleFigures() {
  const { index, parts } = await buildRoleFigures()
  await writeBoardFigure('role-index', index)
  await replaceBoardFigures('role:', index.map((r) => [`role:${r.slug}`, parts.get(r.slug)] as [BoardFigureKey, unknown]))
}

/** Open-job counts per state and city for the job-center, workforce-board and economic-development pages: one scan, one row per state. */
async function refreshOrgJobStats() {
  const stats = await buildOrgJobStats()
  await replaceBoardFigures('org-job-stats:', [...stats].map(([state, v]) => [`org-job-stats:${state}`, v] as [BoardFigureKey, unknown]))
}

const STEPS: readonly (readonly [string, () => Promise<void>])[] = [
  ['employer-rankings', single('employer-rankings', buildEmployerRankings)],
  ['function-rankings', single('function-rankings', buildFunctionRankings)],
  ['workforce-jobs', single('workforce-jobs', jobCounts)],
  ['exposure-rows', single('exposure-rows', buildExposureRows)],
  ['places-job-aggregate', single('places-job-aggregate', loadJobAggregate)],
  ['job-titles', refreshTitleFigures],
  ['entry-roles', refreshEntryRoleFigures],
  ['roles', refreshRoleFigures],
  ['org-job-stats', refreshOrgJobStats],
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
