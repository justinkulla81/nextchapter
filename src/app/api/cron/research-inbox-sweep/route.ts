import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveGoogleConnection, getValidAccessToken } from '@/lib/google/connection'
import { listAlertMessages, getMessageHtml, markMessageRead, extractAlertUrls } from '@/lib/google/gmail'
import { ingestResearchUrl } from '@/lib/research/ingest'

export const maxDuration = 120

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  return NextResponse.json({ messagesSwept, ingested })
}
