import 'server-only'
import { prisma } from '@/lib/prisma'
import { GMAIL_API, ensureFreshAccessToken } from './gmail-api'
import type { EmailConnection } from '@prisma/client'

// Gmail push notifications: Google publishes to a Pub/Sub topic the moment new
// mail lands in a watched mailbox, and a push subscription forwards that to
// /api/google/gmail-push, which runs the normal sync (and so the scam check)
// within seconds instead of waiting for the 10-minute cron. The cron stays as
// the safety net: push delivery is best-effort, and a watch can lapse.
//
// Off unless GMAIL_PUSH_TOPIC and GMAIL_PUSH_SECRET are both set — see
// docs/SETUP.md for the Google Cloud side.

export function isGmailPushConfigured(): boolean {
  return !!process.env.GMAIL_PUSH_TOPIC && !!process.env.GMAIL_PUSH_SECRET
}

// Renew a day ahead of expiry so one missed cron pass never lets a watch lapse.
const RENEW_WITHIN_MS = 24 * 60 * 60 * 1000

export function needsPushWatch(connection: Pick<EmailConnection, 'pushWatchExpiresAt'>): boolean {
  return !connection.pushWatchExpiresAt || connection.pushWatchExpiresAt.getTime() - Date.now() < RENEW_WITHIN_MS
}

export async function startGmailWatch(connection: EmailConnection): Promise<boolean> {
  const topicName = process.env.GMAIL_PUSH_TOPIC
  if (!topicName) return false
  const accessToken = await ensureFreshAccessToken(connection)
  if (!accessToken) return false

  const response = await fetch(`${GMAIL_API}/watch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicName, labelIds: ['INBOX'], labelFilterBehavior: 'INCLUDE' }),
  })
  if (!response.ok) {
    console.error(`Gmail watch failed for connection ${connection.id}: ${response.status} ${await response.text()}`)
    return false
  }
  const data = (await response.json()) as { expiration?: string }
  const expiresAt = data.expiration ? new Date(Number(data.expiration)) : new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
  await prisma.emailConnection.update({ where: { id: connection.id }, data: { pushWatchExpiresAt: expiresAt } })
  return true
}

// Best-effort on disconnect: stop Google publishing for a mailbox we no longer track.
export async function stopGmailWatch(connection: EmailConnection): Promise<void> {
  if (!connection.pushWatchExpiresAt) return
  try {
    const accessToken = await ensureFreshAccessToken(connection)
    if (accessToken) {
      await fetch(`${GMAIL_API}/stop`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
    }
  } catch (error) {
    console.error('Gmail watch stop failed:', error)
  }
  await prisma.emailConnection.update({ where: { id: connection.id }, data: { pushWatchExpiresAt: null } })
}
