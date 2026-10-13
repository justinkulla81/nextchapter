import { NextResponse } from 'next/server'
import { runNewsDiscovery } from '@/lib/news/discover'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 120

/** Daily: searches each discovery topic and files new links in Market Pulse. */
export const GET = withCronRun('news-discovery', async () => {
  const result = await runNewsDiscovery()
  captureServerEvent('cron', 'news_discovery_run', { trigger: 'cron', created: result.created, failed: result.failed.length })
  return NextResponse.json(result)
})
