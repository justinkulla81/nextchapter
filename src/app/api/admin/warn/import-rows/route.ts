import { NextRequest, NextResponse } from 'next/server'
import { importScrapedState } from '@/lib/warn/sync'
import { SCRAPED_STATES, type ScrapedNotice } from '@/lib/warn/sources'

export const maxDuration = 300

/**
 * Receives one state's notices from the daily scraper job: Big Local News's
 * warn-scraper reads the state's page, warn-transformer standardizes it, and
 * the job posts the result here. Only the states in SCRAPED_STATES are
 * accepted, and each notice's source is recorded as that state's own page.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { state?: string; notices?: ScrapedNotice[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const state = (body.state ?? '').toUpperCase()
  if (!(state in SCRAPED_STATES)) {
    return NextResponse.json(
      { error: `${state || '(none)'} is not a scraped state. Expected one of ${Object.keys(SCRAPED_STATES).join(', ')}.` },
      { status: 400 },
    )
  }
  if (!Array.isArray(body.notices)) {
    return NextResponse.json({ error: 'No notices supplied.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await importScrapedState(state, body.notices))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
