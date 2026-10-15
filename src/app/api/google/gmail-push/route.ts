import { NextResponse, after, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { isGmailPushConfigured } from '@/lib/email-tracking/gmail-push'

export const maxDuration = 60

// Pub/Sub push endpoint for Gmail watch notifications. The push subscription's
// endpoint URL carries ?token=<GMAIL_PUSH_SECRET>; anything without it is
// refused. The body is only a pointer ({ emailAddress, historyId }), never
// mail content — the sync itself fetches the messages with the candidate's own
// token, exactly as the cron does. We acknowledge immediately (Pub/Sub retries
// slow responses) and sync after the response.
function tokenMatches(given: string | null): boolean {
  const secret = process.env.GMAIL_PUSH_SECRET
  if (!secret || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  if (!isGmailPushConfigured()) return new NextResponse(null, { status: 404 })
  if (!tokenMatches(request.nextUrl.searchParams.get('token'))) return new NextResponse(null, { status: 401 })

  let emailAddress: string | undefined
  try {
    const body = (await request.json()) as { message?: { data?: string } }
    const decoded = body.message?.data ? JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf-8')) : null
    emailAddress = typeof decoded?.emailAddress === 'string' ? decoded.emailAddress : undefined
  } catch {
    // Malformed payloads are acknowledged, not retried: retrying can't fix them.
    return new NextResponse(null, { status: 204 })
  }
  if (!emailAddress) return new NextResponse(null, { status: 204 })

  const connections = await prisma.emailConnection.findMany({
    where: { connectedEmail: { equals: emailAddress, mode: 'insensitive' }, disconnectedAt: null, needsReconnectAt: null },
    select: { id: true },
  })

  after(async () => {
    for (const c of connections) {
      try {
        await syncGmailConnection(c.id, { maxMessages: 100, ignoreThrottle: true })
      } catch (error) {
        console.error('Push-triggered Gmail sync failed for connection', c.id, error)
      }
    }
  })
  return new NextResponse(null, { status: 204 })
}
