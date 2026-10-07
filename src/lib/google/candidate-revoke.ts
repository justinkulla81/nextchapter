import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Once a candidate has disconnected both Gmail and Calendar, revokes
 * NextChapter's Google grant, so the access also disappears from their
 * Google account's "Third-party connections" list, not just from ours. One
 * consent covers both, so revoking while either is still connected would
 * silently break the other. Never throws: the disconnect already happened.
 */
export async function revokeGoogleGrantIfFullyDisconnected(candidateId: string): Promise<boolean> {
  try {
    const [email, calendar] = await Promise.all([
      prisma.emailConnection.findMany({ where: { candidateId }, select: { refreshToken: true, disconnectedAt: true } }),
      prisma.calendarConnection.findUnique({ where: { candidateId }, select: { refreshToken: true, disconnectedAt: true } }),
    ])
    if (email.some((c) => !c.disconnectedAt) || (calendar && !calendar.disconnectedAt)) return false
    const tokens = [...new Set([...email.map((c) => c.refreshToken), calendar?.refreshToken].filter((t): t is string => !!t))]
    let revoked = false
    for (const token of tokens) {
      const res = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(8000),
      })
      // 400 "invalid_token" means it was already revoked or expired — same outcome.
      if (res.ok || res.status === 400) revoked = true
    }
    return revoked
  } catch (e) {
    console.error('Google grant revoke failed:', e)
    return false
  }
}
