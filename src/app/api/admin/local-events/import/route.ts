import { NextResponse, type NextRequest } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { importLocalEvents, type IncomingEvent, type IncomingSource } from '@/lib/local-events/import'

export const maxDuration = 300

// Bulk import for scripts/local-events/crawl.ts (runs on the Mac, like ncrawl). Same bearer secret as the jobs importer.
export async function POST(req: NextRequest) {
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.NC_ATS_API_KEY)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { sources?: IncomingSource[]; events?: IncomingEvent[] } | null
  if (!body || (!Array.isArray(body.sources) && !Array.isArray(body.events))) return NextResponse.json({ error: 'sources and events arrays required' }, { status: 400 })
  const stats = await importLocalEvents((body.sources ?? []).slice(0, 2000), (body.events ?? []).slice(0, 2000))
  return NextResponse.json(stats)
}
