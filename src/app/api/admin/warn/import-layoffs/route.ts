import { NextRequest, NextResponse } from 'next/server'
import { importLayoffsFyi, recordLayoffsRun } from '@/lib/warn/sync'
import type { LayoffsFyiRow } from '@/lib/warn/layoffs'

export const maxDuration = 300

/**
 * Receives layoffs.fyi rows from the weekly browser job.
 *
 * The fetching happens outside this app because the tracker only serves its
 * data to a rendered browser, which a serverless function is not. The job
 * runs in GitHub Actions and posts here.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { rows?: LayoffsFyiRow[]; summary?: { fetched: number; created: number; promoted: number; error?: string } }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  try {
    // The job posts rows in chunks, then one summary to close out the run.
    if (body.summary) {
      await recordLayoffsRun(body.summary)
      return NextResponse.json({ recorded: true })
    }

    const rows = Array.isArray(body.rows) ? body.rows : []
    if (!rows.length) return NextResponse.json({ error: 'No rows supplied.' }, { status: 400 })
    return NextResponse.json(await importLayoffsFyi(rows))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
