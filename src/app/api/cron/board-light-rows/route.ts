import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { loadReconcileResumePoint, reconcileBoardLightRows } from '@/lib/jobs/board-light-rows'

export const maxDuration = 800

// The reconcile alone has taken up to 730 s, so it gets a budget that leaves the function time to finish.
const RECONCILE_BUDGET_MS = 600_000
/** More skipped pages than this fails the run (and alerts): a few are normal under imports, many mean something is wrong. */
const MAX_FAILED_PAGES = 5

// Nightly check on the board's narrow copy of the job table (BoardLightRow,
// board-light-rows.ts). Triggers keep it in step on every write, so this
// should find nothing to fix; it repairs whatever it does find, 20k ids at a
// time, and reports the count — a non-zero drift means a trigger was off.
// The closed-postings snapshot is NOT built here: it has its own job (cron closed-posting-snapshot), so a slow or cut-off reconcile
// cannot starve it and a stalled snapshot cannot hold up the repair.
//
// The run leaves a note on its ledger row every few pages (ctx.progress) and keeps its result (recordResult), because a run cut off at the
// function time limit (2026-11-06, 11-07 04:40 and 15:38) left no trace of how far it got, and a good night's result was never kept. The
// watchdog's retry resumes from the last note instead of starting over.
export const GET = withCronRun(
  'board-light-rows',
  async (request, ctx) => {
    const resumedFrom = request.nextUrl.searchParams.get('trigger') === 'retry' ? await loadReconcileResumePoint().catch(() => null) : null
    await ctx.progress({ step: 'reconcile started', resumedFrom })
    const result = await reconcileBoardLightRows({
      budgetMs: RECONCILE_BUDGET_MS,
      startAfter: resumedFrom,
      onProgress: (p) => ctx.progress({ step: 'reconcile', resumedFrom, ...p }),
    })
    if (result.upserted > 0 || result.deleted > 0) {
      console.error('Board light rows: nightly reconcile repaired drift', result)
    }
    if (result.failedPages > MAX_FAILED_PAGES) {
      throw new Error(`Board light rows: ${result.failedPages} pages could not be repaired (first ids: ${result.skipped.join(', ')})`)
    }
    return NextResponse.json({ ...result, resumedFrom })
  },
  { recordResult: true }
)
