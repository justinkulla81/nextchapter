import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { captureServerEvent } from '@/lib/posthog/server'
import { newsInboxSenders, sweepNewsInboxAllMailboxes } from '@/lib/research/news-inbox'
import { sendLayoffReceipts } from '@/lib/inbox/receipts'

export const maxDuration = 120

// Every 5 minutes (in bundle-every-5): what the owner emails to news@ is filed and a receipt goes back saying where each
// article went; what they email to layoffs@ gets a receipt saying it arrived and how it is used (owner request, 2026-11-20).
// Reads: two Gmail searches per mailbox, and a NewsletterMessage lookup of at most 10 ids per mailbox when a search finds
// mail. Well under 1 MB a day of database reads. The AI routing runs only for an email not filed before.
export const GET = withCronRun('inbox-receipts', async () => {
  let news = null
  try {
    news = await sweepNewsInboxAllMailboxes()
    if (news.emails > 0) captureServerEvent('cron', 'news_inbox_sweep_run', { trigger: 'cron-5m', ...news })
  } catch (e) {
    console.error('Inbox receipts: news@ pass failed:', e)
  }
  const layoffs = await sendLayoffReceipts(newsInboxSenders())
  return NextResponse.json({ news, layoffs })
})
