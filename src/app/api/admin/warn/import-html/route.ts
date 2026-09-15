import { NextRequest, NextResponse } from 'next/server'
import { importRenderedState } from '@/lib/warn/sync'
import { RENDERED_STATES } from '@/lib/warn/sources'

export const maxDuration = 300

/**
 * Receives a rendered WARN page from the weekly browser job.
 *
 * The page is parsed here rather than in the job so that the parsing stays
 * next to the other states' and under the same tests; the job's only
 * responsibility is producing HTML that a scripted fetch cannot get.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { state?: string; html?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const state = (body.state ?? '').toUpperCase()
  if (!(state in RENDERED_STATES)) {
    return NextResponse.json(
      { error: `${state || '(none)'} is not a rendered state. Expected one of ${Object.keys(RENDERED_STATES).join(', ')}.` },
      { status: 400 }
    )
  }
  if (!body.html || body.html.length < 200) {
    return NextResponse.json({ error: 'No page HTML supplied.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await importRenderedState(state, body.html))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
