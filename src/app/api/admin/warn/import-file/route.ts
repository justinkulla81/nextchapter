import { NextRequest, NextResponse } from 'next/server'
import { importFileState } from '@/lib/warn/sync'
import { FILE_STATES } from '@/lib/warn/sources'

export const maxDuration = 300

/**
 * Receives a WARN file the weekly browser job downloaded.
 *
 * Texas posts its notices as a workbook on a site that refuses every
 * scripted request, so the job fetches it from inside a rendered browser
 * and sends the bytes here. Parsing stays on this side, next to the other
 * states' and under the same tests.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { state?: string; fileBase64?: string; url?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const state = (body.state ?? '').toUpperCase()
  const spec = FILE_STATES[state]
  if (!spec) {
    return NextResponse.json(
      { error: `${state || '(none)'} is not a file state. Expected one of ${Object.keys(FILE_STATES).join(', ')}.` },
      { status: 400 }
    )
  }
  if (!body.fileBase64 || body.fileBase64.length < 200) {
    return NextResponse.json({ error: 'No file supplied.' }, { status: 400 })
  }
  // The address recorded on each notice is the state's own, never whatever
  // was posted: it must begin with the page this state is known to publish on.
  const origin = new URL(spec.page).origin
  const url = body.url?.startsWith(origin) ? body.url : spec.page

  try {
    return NextResponse.json(await importFileState(state, Buffer.from(body.fileBase64, 'base64'), url))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
