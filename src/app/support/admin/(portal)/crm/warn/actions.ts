'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { promoteWarnNoticeById, syncAllWarnStates } from '@/lib/warn/sync'

const BASE = '/support/admin/crm/warn'

/** Turns staged notices into outplacement leads. */
export async function promoteNotices(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  if (ids.length === 0) return { message: 'Nothing selected.' }

  let promoted = 0
  for (const id of ids) {
    if (await promoteWarnNoticeById(id)) promoted++
  }
  captureServerEvent(admin.email ?? 'admin', 'warn_notices_promoted', { count: promoted })
  revalidatePath(BASE)
  revalidatePath('/support/admin/crm/leads')
  return { message: `Created ${promoted} ${promoted === 1 ? 'lead' : 'leads'}.` }
}

/** Marks notices as reviewed and not worth pursuing. */
export async function dismissNotices(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const ids = formData.getAll('selected').map(String).filter(Boolean)
  const reason = String(formData.get('reason') ?? '').trim() || 'Not our market'
  if (ids.length === 0) return { message: 'Nothing selected.' }

  const r = await prisma.warnNotice.updateMany({
    where: { id: { in: ids }, promotedAt: null },
    data: { dismissedAt: new Date(), dismissReason: reason },
  })
  captureServerEvent(admin.email ?? 'admin', 'warn_notices_dismissed', { count: r.count, reason })
  revalidatePath(BASE)
  return { message: `Dismissed ${r.count}. They will not come back on the next sync.` }
}

/** Runs the sync now rather than waiting for Monday. */
export async function runWarnSyncNow(): Promise<{ message: string }> {
  const admin = await requireAdmin()
  const results = await syncAllWarnStates(true)
  captureServerEvent(admin.email ?? 'admin', 'warn_sync_manual', { states: results.length })
  revalidatePath(BASE)
  const parts = results.map((r) =>
    r.error ? `${r.state}: ${r.error}` : `${r.state}: ${r.created} new, ${r.promoted} promoted, ${r.needsReview} to review`
  )
  return { message: parts.join(' · ') }
}
