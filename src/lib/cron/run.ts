import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

const TRIGGERS = new Set(['retry', 'manual'])
function triggerFrom(request: NextRequest): string {
  const t = request.nextUrl.searchParams.get('trigger') ?? ''
  return TRIGGERS.has(t) ? t : 'schedule'
}

type Handler = (request: NextRequest) => Promise<Response> | Response

/**
 * Wraps a cron route's GET so every invocation leaves a record: started,
 * then OK / FAILED. Handles the bearer check, so a route can't forget it.
 *
 * A handler that throws is recorded as FAILED and answered with a 500 (so
 * Vercel's own cron log shows red too). A non-2xx response is also FAILED.
 * A function killed at its time limit never reaches the finish write; that
 * row stays RUNNING and the watchdog marks it TIMED_OUT.
 *
 * Ledger writes are best-effort: a database hiccup must never stop the job
 * itself from running.
 */
export function withCronRun(job: string, handler: Handler) {
  return async function GET(request: NextRequest): Promise<Response> {
    if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const started = Date.now()
    const runId = await prisma.cronRun
      .create({ data: { job, trigger: triggerFrom(request) }, select: { id: true } })
      .then((r) => r.id)
      .catch((e) => {
        console.error('Cron ledger: could not record start of', job, e)
        return null
      })
    const finish = (status: 'OK' | 'FAILED', error?: string) =>
      runId
        ? prisma.cronRun
            .update({
              where: { id: runId },
              data: { status, finishedAt: new Date(), durationMs: Date.now() - started, error: error?.slice(0, 2000) ?? null },
            })
            .catch((e) => console.error('Cron ledger: could not record finish of', job, e))
        : Promise.resolve()

    try {
      const response = await handler(request)
      if (response.ok) await finish('OK')
      else await finish('FAILED', `Responded ${response.status}`)
      return response
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Cron job failed:', job, e)
      await finish('FAILED', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}
