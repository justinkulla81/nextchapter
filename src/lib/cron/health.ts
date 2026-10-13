import type { CronSchedule } from './schedule'

export type JobHealth = 'healthy' | 'failed' | 'timed_out' | 'overdue' | 'waiting'

export interface RunSummary {
  status: string // RUNNING | OK | FAILED | TIMED_OUT
  startedAt: Date
  error?: string | null
}

/** No Vercel function outlives 300s here; a run still RUNNING after this was cut off. */
export const STUCK_AFTER_MS = 6 * 60_000

export function isStuck(run: RunSummary, now: Date): boolean {
  return run.status === 'RUNNING' && now.getTime() - run.startedAt.getTime() > STUCK_AFTER_MS
}

/**
 * Where one job stands, judged from its most recent run.
 *
 * `ledgerSince` is when the ledger first saw any run: a job with no runs at
 * all is only "overdue" once the ledger has existed longer than the job's
 * allowed gap — right after deploy it is "waiting", not broken.
 */
export function assessJob(
  s: Pick<CronSchedule, 'maxGapMinutes'>,
  latest: RunSummary | null,
  ledgerSince: Date | null,
  now: Date,
): { health: JobHealth; detail: string } {
  const gapMs = s.maxGapMinutes * 60_000
  if (!latest) {
    if (ledgerSince && now.getTime() - ledgerSince.getTime() > gapMs) {
      return { health: 'overdue', detail: 'No run has been recorded since tracking began.' }
    }
    return { health: 'waiting', detail: 'No run recorded yet.' }
  }
  if (latest.status === 'TIMED_OUT' || isStuck(latest, now)) {
    return { health: 'timed_out', detail: 'The last run was cut off at the time limit before it finished.' }
  }
  if (latest.status === 'FAILED') {
    return { health: 'failed', detail: latest.error ? `The last run failed: ${latest.error}` : 'The last run failed.' }
  }
  if (now.getTime() - latest.startedAt.getTime() > gapMs) {
    return { health: 'overdue', detail: 'The job has not started when it should have.' }
  }
  return { health: 'healthy', detail: 'The last run completed.' }
}

export const UNHEALTHY: ReadonlySet<JobHealth> = new Set(['failed', 'timed_out', 'overdue'])
