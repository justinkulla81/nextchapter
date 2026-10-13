import { NextRequest, NextResponse } from 'next/server'
import { runNewsDiscovery } from '@/lib/news/discover'
import { captureServerEvent } from '@/lib/posthog/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 120

/** Daily: searches each discovery topic and files new links in Market Pulse. */
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runNewsDiscovery()
  captureServerEvent('cron', 'news_discovery_run', { trigger: 'cron', created: result.created, failed: result.failed.length })
  return NextResponse.json(result)
}
