import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { prisma } from '@/lib/prisma'
import { AI_CRAWLER_RETENTION_DAYS } from '@/lib/http/ai-crawlers'

export const maxDuration = 60

// Daily (in bundle-daily-1030): deletes AiCrawlerHit rows older than the retention window. The admin AI page reads 30 days, so older rows
// are never looked at. Reads no rows; deletes by the `day` index, about one day of rows per run.
export const GET = withCronRun(
  'ai-crawler-prune',
  async () => {
    const cutoff = new Date()
    cutoff.setUTCHours(0, 0, 0, 0)
    cutoff.setUTCDate(cutoff.getUTCDate() - AI_CRAWLER_RETENTION_DAYS)
    const { count } = await prisma.aiCrawlerHit.deleteMany({ where: { day: { lt: cutoff } } })
    return NextResponse.json({ deleted: count, before: cutoff.toISOString().slice(0, 10) })
  },
  { recordResult: true }
)
