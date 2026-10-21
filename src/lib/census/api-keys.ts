// Census API keys for customer orgs. 32 random bytes, stored as a SHA-256
// hash (see crm/capture-token.ts for why a fast hash is right for random
// tokens); the plaintext is shown once.

import 'server-only'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/crm/capture-token'

export type OrgKind = 'outplacement' | 'institution'

export async function createOrgKey(orgKind: OrgKind, orgId: string, label: string, createdBy: string) {
  const live = await prisma.orgApiKey.count({ where: { orgKind, orgId, revokedAt: null } })
  if (live >= 5) return { error: 'Five live keys at most. Turn one off first.' }
  const token = `nck_${randomBytes(32).toString('base64url')}`
  const row = await prisma.orgApiKey.create({
    data: { orgKind, orgId, label: label.trim().slice(0, 60) || 'HR system', prefix: token.slice(0, 10), tokenHash: hashToken(token), createdBy },
    select: { id: true },
  })
  return { id: row.id, token }
}

export function listOrgKeys(orgKind: OrgKind, orgId: string) {
  return prisma.orgApiKey.findMany({
    where: { orgKind, orgId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, prefix: true, createdAt: true, lastUsedAt: true, useCount: true, revokedAt: true },
  })
}

export async function revokeOrgKey(orgKind: OrgKind, orgId: string, keyId: string) {
  const r = await prisma.orgApiKey.updateMany({ where: { id: keyId, orgKind, orgId, revokedAt: null }, data: { revokedAt: new Date() } })
  return r.count ? { ok: true } : { error: 'That key is already off.' }
}

export async function verifyOrgKey(header: string | null): Promise<{ keyId: string; orgKind: OrgKind; orgId: string } | null> {
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  if (!token.startsWith('nck_')) return null
  const k = await prisma.orgApiKey.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!k || k.revokedAt) return null
  await prisma.orgApiKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date(), useCount: { increment: 1 } } })
  return { keyId: k.id, orgKind: k.orgKind as OrgKind, orgId: k.orgId }
}
