import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { buildCountryRequest, parseCountryReply, type CountryItem } from './layoff-country-rules'

const BATCH = 20
const WINDOW_DAYS = 90

export interface CountryFillResult { considered: number; filled: number; unplaced: number }

/**
 * Fills in the country of reported layoffs that name no state, a bounded batch per run (the layoff-news cron runs every three
 * hours, so a backlog drains in a day). One small model call covers twenty layoffs. A layoff the story does not place gets
 * countryCheckedAt and no country, so it is asked once; a failed call changes nothing and is retried next run.
 */
export async function fillLayoffCountries(limit = 40): Promise<CountryFillResult> {
  const result: CountryFillResult = { considered: 0, filled: 0, unplaced: 0 }
  const notices = await prisma.warnNotice.findMany({
    where: {
      source: 'MANUAL_ANNOUNCEMENT', state: null, country: null, countryCheckedAt: null, dismissedAt: null,
      noticeDate: { gte: new Date(Date.now() - WINDOW_DAYS * 86_400_000) },
    },
    orderBy: { noticeDate: 'desc' },
    take: limit,
    select: { id: true, employer: true, sourceUrl: true },
  })
  result.considered = notices.length
  if (notices.length === 0) return result

  const mentions = await prisma.layoffNewsMention.findMany({
    where: { noticeId: { in: notices.map((n) => n.id) } },
    select: { noticeId: true, headline: true },
  })
  const items: CountryItem[] = notices.map((n) => ({
    id: n.id, employer: n.employer, sourceUrl: n.sourceUrl,
    headlines: mentions.filter((m) => m.noticeId === n.id).map((m) => m.headline),
  }))

  const client = getAnthropicClient()
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    try {
      const msg = await client.messages.create(buildCountryRequest(batch))
      const answers = parseCountryReply(msg.content.find((b) => b.type === 'text')?.text ?? '', batch.map((b) => b.id))
      for (const [id, country] of answers) {
        await prisma.warnNotice.update({ where: { id }, data: { country, countryCheckedAt: new Date() } })
        if (country) result.filled++
        else result.unplaced++
      }
    } catch (e) {
      console.error('Layoff country batch failed:', e)
    }
  }
  return result
}
