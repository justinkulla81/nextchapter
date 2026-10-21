import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Asks Google to revoke each token. Revoking any token for our client revokes
 * the member's whole grant, so it also disappears from their Google account's
 * "Third-party connections" list. True when Google confirmed at least one.
 * Never throws.
 */
export async function revokeGoogleTokens(tokens: (string | null | undefined)[]): Promise<boolean> {
  const unique = [...new Set(tokens.filter((t): t is string => !!t))]
  let revoked = false
  for (const token of unique) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(8000),
      })
      // 400 "invalid_token" means it was already revoked or expired — same outcome.
      if (res.ok || res.status === 400) revoked = true
    } catch (e) {
      console.error('Google token revoke failed:', e)
    }
  }
  return revoked
}

/**
 * Deletes the stored Google tokens on every DISCONNECTED Gmail/Calendar row
 * of this member. A disconnected row keeps only its connection dates (and
 * the activity detected while it was connected); a reconnect writes fresh
 * tokens through the OAuth callback's upsert. The columns are NOT NULL, so
 * "deleted" is an empty string (stored as-is, see encryptToken).
 */
export async function clearDisconnectedGoogleTokens(candidateId: string): Promise<void> {
  const cleared = { accessToken: '', refreshToken: '' }
  await Promise.all([
    prisma.emailConnection.updateMany({ where: { candidateId, disconnectedAt: { not: null } }, data: cleared }),
    prisma.calendarConnection.updateMany({ where: { candidateId, disconnectedAt: { not: null } }, data: cleared }),
  ])
}

/**
 * Called after a Gmail or Calendar disconnect. Once both are disconnected,
 * revokes NextChapter's Google grant. One consent covers both, so revoking
 * while either is still connected would silently break the other. Then
 * deletes the stored tokens of every disconnected row: a still-connected
 * Calendar keeps its own tokens and the grant stays until it is disconnected
 * too. Never throws: the disconnect already happened.
 */
export async function revokeGoogleGrantIfFullyDisconnected(candidateId: string): Promise<boolean> {
  let revoked = false
  try {
    const [email, calendar] = await Promise.all([
      prisma.emailConnection.findMany({ where: { candidateId }, select: { refreshToken: true, accessToken: true, disconnectedAt: true } }),
      prisma.calendarConnection.findUnique({ where: { candidateId }, select: { refreshToken: true, accessToken: true, disconnectedAt: true } }),
    ])
    const fullyDisconnected = !email.some((c) => !c.disconnectedAt) && !(calendar && !calendar.disconnectedAt)
    if (fullyDisconnected) {
      revoked = await revokeGoogleTokens([...email.map((c) => c.refreshToken), calendar?.refreshToken])
    }
  } catch (e) {
    console.error('Google grant revoke failed:', e)
  }
  try {
    await clearDisconnectedGoogleTokens(candidateId)
  } catch (e) {
    console.error('Clearing disconnected Google tokens failed:', e)
  }
  return revoked
}
