'use server'

// Entrepreneurship › Founders: the center marks that it reached out to a founder, so other offices see it was handled.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/higher-ed/access'
import type { AccessToken } from '@/lib/higher-ed/workspaces'
import { captureServerEvent } from '@/lib/posthog/server'
import { setMyConsent } from './member-actions'
import { parseVentureReport, saveVentureReport } from '@/lib/higher-ed/ventures'

type Result = { error?: string; ok?: boolean; message?: string }
const CENTER: AccessToken[] = ['ENTREPRENEURSHIP', 'INSTITUTION_ADMIN']

export async function markVentureContacted(slug: string, flagId: string, contacted: boolean): Promise<Result> {
  const ctx = await requireWorkspace(slug, 'ventures', { write: true })
  if (!CENTER.some((r) => ctx.tokens.has(r))) return { error: 'Only the entrepreneurship center or an admin can mark founders as contacted.' }
  const r = await prisma.ventureFlag.updateMany({
    where: { id: flagId, institutionId: ctx.institution.id },
    data: contacted ? { contactedAt: new Date(), contactedBy: ctx.email ?? null } : { contactedAt: null, contactedBy: null },
  })
  if (r.count === 0) return { error: 'That founder is no longer on the list. Reload the page.' }
  captureServerEvent(ctx.userId, 'he_venture_contacted', { institutionId: ctx.institution.id, flagId, contacted })
  revalidatePath(`/i/${slug}/ventures`)
  return { ok: true, message: contacted ? 'Marked as contacted. Every office sees it.' : 'Marked as not contacted yet.' }
}

// The alum's answer on the Home card: share the venture with the center, or not now (both saved, so the card is not shown again).
export async function shareVenture(slug: string, share: boolean): Promise<Result> {
  const r = await setMyConsent(slug, 'SHARE_VENTURE', share)
  if (r.error) return { error: r.error }
  return { ok: true }
}

// The alum's "Your company" form on their Home: name, website, funding to date and an exit. Saving it shares the venture with the
// entrepreneurship center (SHARE_VENTURE on), which every office's Founders list then shows.
export async function reportMyVenture(slug: string, _prev: Result | undefined, formData: FormData): Promise<Result> {
  const r = parseVentureReport(formData)
  if ('error' in r) return { error: r.error }
  const ctx = await requireWorkspace(slug, 'candidate')
  if (!ctx.memberId) return { error: 'This is a preview: there’s no member record behind it, so nothing was saved.' }
  const consent = await setMyConsent(slug, 'SHARE_VENTURE', true)
  if (consent.error) return { error: consent.error }
  await saveVentureReport(ctx.institution.id, ctx.memberId, r)
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved. The entrepreneurship center sees it, and you can update it any time.' }
}
