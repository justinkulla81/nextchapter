import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveGoogleConnection, getValidAccessToken } from '@/lib/google/connection'
import { listAlertMessages, getMessageHtml, markMessageRead, extractAlertUrls } from '@/lib/google/gmail'
import { ingestResearchUrl } from '@/lib/research/ingest'
import { sweepNewsletters } from '@/lib/research/newsletter-sweep'
import { sweepNewsInboxAllMailboxes } from '@/lib/research/news-inbox'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 120

export const GET = withCronRun('research-inbox-sweep', async () => {
  const connection = await getActiveGoogleConnection()
  if (!connection) {
    return NextResponse.json({ swept: 0, ingested: 0, reason: 'no_connection' })
  }

  let accessToken = await getValidAccessToken()
  if (!accessToken) {
    return NextResponse.json({ swept: 0, ingested: 0, reason: 'no_token' })
  }

  let messagesSwept = 0
  let ingested = 0

  try {
    let messages
    try {
      messages = await listAlertMessages(accessToken)
    } catch (err) {
      // A stored token Google no longer accepts (revoked or replaced before its expiry): refresh once and retry.
      if (!(err instanceof Error && / 401 /.test(err.message))) throw err
      const fresh = await getValidAccessToken({ force: true })
      if (!fresh) throw err
      accessToken = fresh
      messages = await listAlertMessages(accessToken)
    }

    for (const message of messages) {
      try {
        const html = await getMessageHtml(accessToken, message.id)
        if (html) {
          const urls = extractAlertUrls(html)
          for (const url of urls) {
            const existing = await prisma.researchLibraryItem.findFirst({ where: { url } })
            if (existing) continue
            await ingestResearchUrl(url, 'inbox')
            ingested++
          }
        }
        await markMessageRead(accessToken, message.id)
        messagesSwept++
      } catch (err) {
        // One bad message shouldn't stop the sweep.
        console.error('Failed to process alert message:', message.id, err)
      }
    }

    await prisma.googleInboxConnection.update({
      where: { id: connection.id },
      data: { lastSweepAt: new Date() },
    })
  } catch (err) {
    console.error('Research inbox sweep failed:', err)
    // The reason goes in the answer so the cron ledger (and the failure email) says what broke.
    const reason = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300)
    return NextResponse.json({ error: 'Sweep failed', reason }, { status: 500 })
  }

  // Newsletters are a separate pass: a failure here must not hide the alert sweep above.
  let newsletters = null
  try {
    newsletters = await sweepNewsletters(accessToken)
    captureServerEvent('cron', 'newsletter_sweep_run', { trigger: 'cron', ...newsletters })
  } catch (err) {
    console.error('Newsletter sweep failed:', err)
  }

  // What Justin sent to news@: its own pass, so a failure here hides neither sweep above.
  let newsInbox = null
  try {
    newsInbox = await sweepNewsInboxAllMailboxes()
    captureServerEvent('cron', 'news_inbox_sweep_run', { trigger: 'cron', ...newsInbox })
  } catch (err) {
    console.error('News inbox sweep failed:', err)
  }

  return NextResponse.json({ messagesSwept, ingested, newsletters, newsInbox })
})
