import 'server-only'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './oauth'
import type { GoogleInboxConnection } from '@prisma/client'

export async function getActiveGoogleConnection(): Promise<GoogleInboxConnection | null> {
  return prisma.googleInboxConnection.findFirst({ orderBy: { connectedAt: 'desc' } })
}

// Returns a valid access token, transparently refreshing (and persisting
// the refreshed token) if the stored one is expired or about to expire.
// Returns null if no inbox is connected — callers should treat that as
// "nothing to sweep," not an error.
export async function getValidAccessToken(): Promise<string | null> {
  const connection = await getActiveGoogleConnection()
  if (!connection) return null

  if (connection.expiresAt.getTime() > Date.now() + 60_000) {
    return connection.accessToken
  }

  const refreshed = await refreshAccessToken(connection.refreshToken)
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000)
  await prisma.googleInboxConnection.update({
    where: { id: connection.id },
    data: { accessToken: refreshed.access_token, expiresAt },
  })
  return refreshed.access_token
}
