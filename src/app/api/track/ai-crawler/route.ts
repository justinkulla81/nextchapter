import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { AI_CRAWLERS } from '@/lib/http/ai-crawlers'

// Called by the proxy (never by browsers) when a named AI crawler fetches a page. One row per day, bot and path, with a
// hit counter, so a crawler reading 10,000 pages adds at most 10,000 rows and a repeat visit adds none. Best effort:
// the proxy does not wait for the answer.
export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ recorded: false }, { status: 401 })
  }
  try {
    const body = await request.json()
    const crawler = AI_CRAWLERS.find((c) => c.bot === body?.bot)
    const path = typeof body?.path === 'string' ? body.path.slice(0, 300) : null
    if (!crawler || !path) return NextResponse.json({ recorded: false })
    const day = new Date()
    day.setUTCHours(0, 0, 0, 0)
    await prisma.aiCrawlerHit.upsert({
      where: { day_bot_path: { day, bot: crawler.bot, path } },
      create: { day, bot: crawler.bot, vendor: crawler.vendor, purpose: crawler.purpose, path },
      update: { hits: { increment: 1 }, lastSeenAt: new Date() },
    })
    return NextResponse.json({ recorded: true })
  } catch (error) {
    console.error('Failed to record AI crawler hit:', error)
    return NextResponse.json({ recorded: false })
  }
}
