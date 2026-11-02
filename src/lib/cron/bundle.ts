import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

type JobRoute = (request: NextRequest) => Promise<Response> | Response

/**
 * One vercel.json cron that runs several small jobs one after another. Vercel allows 100 crons in all, so jobs that
 * take a second or two and run around the same time share a slot instead.
 *
 * Each job is still its own route, already wrapped in withCronRun, so it keeps its own ledger row, its own retry and
 * its own "Run now". One job failing does not stop the rest. The jobs and the bundle's schedule are listed in
 * CRON_BUNDLES (schedule.ts), which is how the watchdog keeps checking each job by name.
 */
export function cronBundle(jobs: Record<string, JobRoute>) {
  return async function GET(request: NextRequest): Promise<Response> {
    if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const results: Record<string, number> = {}
    for (const [job, route] of Object.entries(jobs)) {
      try {
        results[job] = (await route(request)).status
      } catch (e) {
        console.error('Cron bundle: job threw', job, e)
        results[job] = 500
      }
    }
    const ok = Object.values(results).every((status) => status >= 200 && status < 300)
    return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 })
  }
}
