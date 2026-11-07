import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

const TRIGGERS = new Set(['retry', 'manual'])
function triggerFrom(request: NextRequest): string {
  const t = request.nextUrl.searchParams.get('trigger') ?? ''
  return TRIGGERS.has(t) ? t : 'schedule'
}

/**
 * A busy moment at the database (the connection pool full, the pooler briefly unreachable) fails a job in its first
 * seconds, and the same job a few seconds later is fine. Those are retried once here instead of being recorded as a
 * failure and emailed. A statement timeout (57014) is not retried: running the same slow query again only repeats it.
 */
const TRANSIENT_CODES = new Set(['P2024', 'P1001', 'P1002', 'P1008', 'P1017'])
const RETRY_WITHIN_MS = 30_000
const RETRY_PAUSE_MS = 5_000
const LEDGER_RETRY_PAUSE_MS = 2_000
export function isTransientDbError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code
  if (code && TRANSIENT_CODES.has(code)) return true
  const message = e instanceof Error ? e.message : String(e)
  return /Timed out fetching a new connection|Can't reach database server|max clients reached|Server has closed the connection/i.test(message)
}

/** Handed to a cron handler: `progress` keeps a short note on this run's ledger row while it works. */
export interface CronContext {
  /**
   * Overwrites CronRun.detail with the start of `note` (JSON). A run that is cut off at its time limit never reaches its finish write, so
   * without this it leaves no trace of how far it got. Best-effort: a failed write never stops the job.
   */
  progress: (note: unknown) => Promise<void>
}

type Handler = (request: NextRequest, ctx: CronContext) => Promise<Response> | Response

/**
 * Wraps a cron route's GET so every invocation leaves a record: started,
 * then OK / FAILED. Handles the bearer check, so a route can't forget it.
 *
 * A handler that throws is recorded as FAILED and answered with a 500 (so
 * Vercel's own cron log shows red too). A non-2xx response is also FAILED.
 * A function killed at its time limit never reaches the finish write; that
 * row stays RUNNING and the watchdog marks it TIMED_OUT.
 *
 * recordResult: keep the start of a successful run's JSON answer in CronRun.detail.
 * A handler may also call ctx.progress(note) while it runs (see CronContext).
 *
 * Ledger writes are best-effort: a database hiccup must never stop the job
 * itself from running.
 */
export function withCronRun(job: string, handler: Handler, opts: { recordResult?: boolean } = {}) {
  return async function GET(request: NextRequest): Promise<Response> {
    if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const started = Date.now()
    // The first jobs in a bundle start in the same second as the other 14:30 crons, when the connection pool is busiest.
    // A start row that fails once is tried again after a pause; without it the job runs but leaves no record, and Job
    // health reports it overdue (lead-nurture, 2026-11-06 and 11-07).
    const recordStart = () => prisma.cronRun.create({ data: { job, trigger: triggerFrom(request) }, select: { id: true } }).then((r) => r.id)
    const runId = await recordStart()
      .catch(async (e) => {
        console.warn('Cron ledger: could not record start of', job, 'retrying once', e)
        await new Promise((r) => setTimeout(r, LEDGER_RETRY_PAUSE_MS))
        return recordStart()
      })
      .catch((e) => {
        console.error('Cron ledger: could not record start of', job, e)
        return null
      })
    const finish = (status: 'OK' | 'FAILED', error?: string, detail?: string) =>
      runId
        ? prisma.cronRun
            .update({
              where: { id: runId },
              data: { status, finishedAt: new Date(), durationMs: Date.now() - started, error: error?.slice(0, 2000) ?? null, ...(detail ? { detail: detail.slice(0, 2000) } : {}) },
            })
            .catch((e) => console.error('Cron ledger: could not record finish of', job, e))
        : Promise.resolve()

    const ctx: CronContext = {
      progress: async (note) => {
        if (!runId) return
        await prisma.cronRun
          .update({ where: { id: runId }, data: { detail: JSON.stringify(note).slice(0, 2000) } })
          .catch((e) => console.warn('Cron ledger: could not record progress of', job, e))
      },
    }

    try {
      let response: Response
      try {
        response = await handler(request, ctx)
      } catch (e) {
        if (!isTransientDbError(e) || Date.now() - started > RETRY_WITHIN_MS) throw e
        console.warn('Cron job hit a transient database error, retrying once:', job, e)
        await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS))
        response = await handler(request, ctx)
      }
      if (response.ok) {
        // A job that opts in keeps the start of its JSON answer, so a run that did nothing (a dry run) or stopped early can be told from one that worked.
        const detail = opts.recordResult ? await response.clone().text().then((t) => t.slice(0, 2000)).catch(() => '') : ''
        await finish('OK', undefined, detail)
      }
      else {
        // The response body usually says what failed (a job that reports its failed steps); keep the start of it in the ledger.
        const detail = await response.clone().text().then((t) => t.slice(0, 600)).catch(() => '')
        await finish('FAILED', detail ? `Responded ${response.status}: ${detail}` : `Responded ${response.status}`)
      }
      return response
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Cron job failed:', job, e)
      await finish('FAILED', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}
