import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { loadReconcileResumePoint, reconcileBoardLightRows } from '@/lib/jobs/board-light-rows'

export const maxDuration = 800

// A night's share of the check: about a third of the table at today's page times, picked up the next night where it stopped
// (loadReconcileResumePoint), so the whole table is checked every five or six nights. It was 600 s a night re-checking the same first
// pages and never reaching the rest; every run since 2026-11-08 found nothing to repair (#33 by database time in the 2026-11-17 statement
// stats: ~7 s and ~196,000 buffers a page). The triggers keep the copy in step between checks.
const RECONCILE_BUDGET_MS = 200_000
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
    const resumedFrom = await loadReconcileResumePoint().catch(() => null)
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
