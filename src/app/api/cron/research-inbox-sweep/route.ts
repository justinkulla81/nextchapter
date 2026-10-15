import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveGoogleConnection, getValidAccessToken } from '@/lib/google/connection'
import { listAlertMessages, getMessageHtml, markMessageRead, extractAlertUrls } from '@/lib/google/gmail'
import { ingestResearchUrl } from '@/lib/research/ingest'
import { sweepNewsletters } from '@/lib/research/newsletter-sweep'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 120

export const GET = withCronRun('research-inbox-sweep', async () => {
  const connection = await getActiveGoogleConnection()
  if (!connection) {
    return NextResponse.json({ swept: 0, ingested: 0, reason: 'no_connection' })
  }

  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    return NextResponse.json({ swept: 0, ingested: 0, reason: 'no_token' })
  }

  let messagesSwept = 0
  let ingested = 0

  try {
    const messages = await listAlertMessages(accessToken)

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
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
  }

  // Newsletters are a separate pass: a failure here must not hide the alert sweep above.
  let newsletters = null
  try {
    newsletters = await sweepNewsletters(accessToken)
    captureServerEvent('cron', 'newsletter_sweep_run', { trigger: 'cron', ...newsletters })
  } catch (err) {
    console.error('Newsletter sweep failed:', err)
  }

  return NextResponse.json({ messagesSwept, ingested, newsletters })
})
