import 'server-only'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/security/token-crypto'

export interface AdminLinkedIn {
  accessToken: string
  personUrn: string
  memberName: string | null
  expiresAt: Date
}

/** The admin's live LinkedIn connection, or null when none, disconnected or lapsed. */
export async function getAdminLinkedIn(adminEmail: string): Promise<AdminLinkedIn | null> {
  const c = await prisma.linkedInAdminConnection.findUnique({ where: { adminEmail } })
  if (!c || c.disconnectedAt || c.expiresAt.getTime() <= Date.now()) return null
  return { accessToken: decryptToken(c.accessToken), personUrn: c.personUrn, memberName: c.memberName, expiresAt: c.expiresAt }
}
