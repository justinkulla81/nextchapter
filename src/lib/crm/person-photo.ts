import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_BYTES = 300 * 1024
const DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/

/**
 * Stores a profile photo sent by the capture extension (already shrunk to a
 * small JPEG data URL there) in the `avatars` bucket and records its URL on
 * the person. Never throws — a failed photo must not fail the capture.
 */
export async function savePersonPhoto(personId: string, dataUrl: string | undefined): Promise<boolean> {
  const m = dataUrl ? DATA_URL.exec(dataUrl) : null
  if (!m) return false
  const bytes = Buffer.from(m[1], 'base64')
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return false
  try {
    const admin = createAdminClient()
    const path = `crm-people/${personId}.jpg`
    const { error } = await admin.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
    if (error) return false
    // The path is fixed per person, so a version query keeps a changed photo from being served from cache.
    const url = `${admin.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
    await prisma.crmPerson.update({ where: { id: personId }, data: { photoUrl: url } })
    return true
  } catch (e) {
    console.error('CRM person photo save failed', personId, e)
    return false
  }
}
