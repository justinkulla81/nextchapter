'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { generateToken, hashToken } from '@/lib/crm/capture-token'

const BASE = '/support/admin/crm/capture-tokens'

/**
 * Creates a token and returns the plaintext ONCE.
 *
 * Only the hash is stored, so this value cannot be recovered — which is the
 * point, and the page says so plainly rather than letting you discover it
 * after closing the tab.
 */
export async function createCaptureToken(_prev: unknown, formData: FormData): Promise<{ token?: string; message: string }> {
  const admin = await requireAdmin()
  const label = String(formData.get('label') ?? '').trim()
  if (!label) return { message: 'Give the token a label so you know which browser it is in.' }

  const token = generateToken()
  await prisma.crmCaptureToken.create({
    data: { tokenHash: hashToken(token), label, createdByEmail: admin.email ?? null },
  })
  captureServerEvent(admin.email ?? 'admin', 'crm_capture_token_created', { label })
  revalidatePath(BASE)
  return { token, message: 'Copy this now — it is not stored and cannot be shown again.' }
}

export async function revokeCaptureToken(tokenId: string) {
  const admin = await requireAdmin()
  await prisma.crmCaptureToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } })
  captureServerEvent(admin.email ?? 'admin', 'crm_capture_token_revoked', { tokenId })
  revalidatePath(BASE)
}
