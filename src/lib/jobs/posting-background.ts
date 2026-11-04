import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// A member's fit check, interview prep and cover letter are AI calls that take 10-40 seconds. Running them inside the
// click made the member wait on a spinner. Instead the action marks the posting as working, returns at once, and runs the
// call with after() (it keeps the same function alive after the response). The page shows "Working…" and refreshes itself
// when the work is done (PostingWorkWatcher).

export type PostingWorkKind = 'fit_analysis' | 'interview_prep' | 'cover_letter'

/** A posting counts as working for this long at most, so a run that was cut off never leaves it stuck. */
export const POSTING_WORK_WINDOW_MS = 5 * 60_000

export function isPostingWorking(backgroundWorkAt: Date | null, now: number = Date.now()): boolean {
  return !!backgroundWorkAt && now - backgroundWorkAt.getTime() < POSTING_WORK_WINDOW_MS
}

/** Marks the posting as working. Call before returning from the action, so the refreshed page already shows it. */
export async function markPostingWorking(jobPostingId: string): Promise<void> {
  await prisma.jobPosting.update({ where: { id: jobPostingId }, data: { backgroundWorkAt: new Date() } })
}

/**
 * Runs the work (inside after()), then clears the mark, whether it worked or not. A failure inside the work is logged and
 * leaves the posting as it was (the page's own error fields, such as interviewPrepError, still say what went wrong).
 */
export async function runPostingWork(jobPostingId: string, candidateId: string, kind: PostingWorkKind, work: () => Promise<void>): Promise<void> {
  const started = Date.now()
  let ok = true
  try {
    await work()
  } catch (error) {
    ok = false
    console.error('posting background work failed:', kind, jobPostingId, error)
  } finally {
    await prisma.jobPosting.update({ where: { id: jobPostingId }, data: { backgroundWorkAt: null } }).catch(() => {})
    captureServerEvent(candidateId, 'job_posting_work_finished', { jobId: jobPostingId, kind, ok, durationMs: Date.now() - started })
  }
}
