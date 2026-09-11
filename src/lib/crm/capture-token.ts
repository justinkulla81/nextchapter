import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

/**
 * Tokens are stored as a SHA-256 hash, never in plaintext.
 *
 * No salt and no bcrypt here on purpose: these are 32 bytes of CSPRNG output,
 * not passwords. There is no dictionary to attack, so a fast hash is the right
 * tool — the property that matters is that a database read cannot be replayed
 * against the endpoint.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken(): string {
  return `ncx_${randomBytes(32).toString('base64url')}`
}

export async function verifyCaptureToken(header: string | null): Promise<string | null> {
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  if (!token) return null

  const record = await prisma.crmCaptureToken.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!record || record.revokedAt) return null

  await prisma.crmCaptureToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
  })
  return record.id
}
