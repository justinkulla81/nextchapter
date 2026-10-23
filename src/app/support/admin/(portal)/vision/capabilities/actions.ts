'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { CAPABILITIES } from '@/lib/vision/capabilities'
import { cleanHttpsUrl, isCellStatus, looksLikeMissingTable } from '@/lib/vision/capability-matrix'

const BASE = '/support/admin/vision/capabilities'

const MISSING = 'The capability tables are not in the database yet. Apply prisma/manual/2026-10-23-capability-matrix.sql first, then try again. Nothing you typed was saved.'

function ensureCapability(key: string) {
  const index = CAPABILITIES.findIndex((c) => c.key === key)
  const c = CAPABILITIES[index]
  const data = { area: c.area, name: c.name, description: c.description, ours: c.ours, evidencePath: c.evidencePath, sortOrder: index }
  return prisma.productCapability.upsert({ where: { key }, create: { key, ...data }, update: data, select: { id: true } })
}

/**
 * Sets one cell: what a competitor does for one capability, with its source and the date it was checked.
 * Admin only. A YES, PARTIAL or NO needs an https link, because a fact about a competitor with no source cannot be used.
 * On a problem it sends the person back to the same editor with what they typed, so nothing has to be retyped.
 */
export async function saveCapabilityCell(formData: FormData) {
  const admin = await requireAdmin()
  const get = (k: string) => String(formData.get(k) ?? '')
  const competitorId = get('competitorId')
  const capabilityKey = get('capabilityKey')
  const status = get('status')
  const note = get('note').trim().slice(0, 1000)
  const rawUrl = get('evidenceUrl').trim()
  const checkedBy = get('checkedBy').trim().slice(0, 80) || admin.email || 'admin'

  const keep = new URLSearchParams()
  for (const k of ['area', 'cols']) if (get(k)) keep.set(k, get(k))
  keep.set('edit', `${competitorId}~${capabilityKey}`)
  const back = (error: string, draft = true) => {
    const p = new URLSearchParams(keep)
    p.set('error', error)
    if (draft) { p.set('d_status', status); p.set('d_note', note.slice(0, 400)); p.set('d_url', rawUrl.slice(0, 300)); p.set('d_by', checkedBy) }
    redirect(`${BASE}?${p.toString()}#editor`)
  }

  if (!competitorId || !CAPABILITIES.some((c) => c.key === capabilityKey)) back('That cell is not recognised. Reopen it from the table.', false)
  if (!isCellStatus(status)) back('Choose Yes, Partial, No or Unknown.')
  const evidenceUrl = cleanHttpsUrl(rawUrl)
  if (rawUrl && !evidenceUrl) back('The source link must start with https:// and be a full web address.')
  if (status !== 'UNKNOWN' && !evidenceUrl) back('Add the https:// link that shows this. A Yes, Partial or No needs a source; choose Unknown if you could not find one.')

  let failure: string | null = null
  try {
    const competitor = await prisma.productCompetitor.findUnique({ where: { id: competitorId }, select: { id: true } })
    if (!competitor) {
      failure = 'That competitor no longer exists.'
    } else {
      const cap = await ensureCapability(capabilityKey)
      const checkedAt = new Date()
      const fields = { status: status as 'YES' | 'PARTIAL' | 'NO' | 'UNKNOWN', note: note || null, evidenceUrl: evidenceUrl ?? null, checkedAt, checkedBy }
      await prisma.competitorCapability.upsert({
        where: { competitorId_capabilityId: { competitorId, capabilityId: cap.id } },
        create: { competitorId, capabilityId: cap.id, ...fields },
        update: fields,
      })
    }
  } catch (e) {
    failure = looksLikeMissingTable(e) ? MISSING : 'The cell could not be saved. Try again; if it keeps failing, the database may be unavailable.'
  }
  if (failure) back(failure)

  captureServerEvent(admin.email ?? 'admin', 'capability_cell_set', {
    competitorId, capabilityKey, status, hasEvidence: Boolean(evidenceUrl), hasNote: Boolean(note),
  })
  revalidatePath(BASE)
  const ok = new URLSearchParams(keep)
  ok.delete('edit')
  ok.set('saved', `${competitorId}~${capabilityKey}`)
  redirect(`${BASE}?${ok.toString()}`)
}

/** Writes the catalog in code into ProductCapability, so the database rows match what the page shows. Safe to repeat. */
export async function syncCapabilityCatalog(formData: FormData) {
  const admin = await requireAdmin()
  const keep = new URLSearchParams()
  for (const k of ['area', 'cols']) { const v = String(formData.get(k) ?? ''); if (v) keep.set(k, v) }
  let failure: string | null = null
  try {
    await prisma.$transaction(
      CAPABILITIES.map((c, i) => {
        const data = { area: c.area, name: c.name, description: c.description, ours: c.ours, evidencePath: c.evidencePath, sortOrder: i }
        return prisma.productCapability.upsert({ where: { key: c.key }, create: { key: c.key, ...data }, update: data })
      }),
    )
  } catch (e) {
    failure = looksLikeMissingTable(e) ? MISSING : 'The catalog could not be written. Try again.'
  }
  if (failure) { keep.set('error', failure); redirect(`${BASE}?${keep.toString()}`) }
  captureServerEvent(admin.email ?? 'admin', 'capability_catalog_synced', { count: CAPABILITIES.length })
  revalidatePath(BASE)
  keep.set('synced', String(CAPABILITIES.length))
  redirect(`${BASE}?${keep.toString()}`)
}
