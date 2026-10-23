import 'server-only'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './oauth'
import type { GoogleInboxConnection } from '@prisma/client'

/**
 * The PRIMARY mailbox: the oldest connection. Market Pulse, compose-and-send
 * and the single-person mail check use this one; the CRM sweep reads every
 * connected mailbox (see getAllGoogleConnections).
 */
export async function getActiveGoogleConnection(): Promise<GoogleInboxConnection | null> {
  return prisma.googleInboxConnection.findFirst({ orderBy: { connectedAt: 'asc' } })
}

/** Mail you send from the CRM comes from the company address, when it is connected. */
const SEND_FROM_DOMAIN = '@launchyournextchapter.com'

/**
 * A valid token for the mailbox CRM mail is sent from: the company-domain
 * account if one is connected, otherwise the primary mailbox. Reading mail
 * is unaffected — every connected mailbox is swept.
 */
export async function getValidSendAccessToken(): Promise<string | null> {
  const all = await getAllGoogleConnections()
  const sender = all.find((c) => c.email.toLowerCase().endsWith(SEND_FROM_DOMAIN)) ?? all[0]
  return sender ? getValidAccessTokenFor(sender) : null
}

export async function getAllGoogleConnections(): Promise<GoogleInboxConnection[]> {
  return prisma.googleInboxConnection.findMany({ orderBy: { connectedAt: 'asc' } })
}

/** A valid access token for one connection, refreshing and saving it when it is about to expire. */
export async function getValidAccessTokenFor(connection: GoogleInboxConnection): Promise<string> {
  if (connection.expiresAt.getTime() > Date.now() + 60_000) return connection.accessToken
  const refreshed = await refreshAccessToken(connection.refreshToken)
  await prisma.googleInboxConnection.update({
    where: { id: connection.id },
    data: { accessToken: refreshed.access_token, expiresAt: new Date(Date.now() + refreshed.expires_in * 1000) },
  })
  return refreshed.access_token
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
