import 'server-only'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateUpload } from '@/lib/uploads/validate-upload'
import { brandOwnerKey, cleanBrandText, type EmployerBrandView } from './brand-shared'

// An employer's own look for its portal Home splash (owner decision 2026-11-17). See EmployerBrand in prisma/schema.prisma.

export { brandOwnerKey }

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_FIELDS = { logo: 'logoUrl', office: 'officeImageUrl', product: 'productImageUrl' } as const
type ImageField = keyof typeof IMAGE_FIELDS

// Fail-soft: a missing table (before the SQL file is applied) or any read error reads as "no brand yet".
export async function readEmployerBrand(ownerKey: string): Promise<EmployerBrandView | null> {
  try {
    return await prisma.employerBrand.findUnique({
      where: { ownerKey },
      select: { logoUrl: true, officeImageUrl: true, productImageUrl: true, productName: true, tagline: true },
    })
  } catch (e) {
    console.error('readEmployerBrand failed', e)
    return null
  }
}

async function uploadBrandImage(ownerKey: string, file: File | null, kind: ImageField): Promise<string | null | { error: string }> {
  if (!file || file.size === 0) return null
  const check = await validateUpload(file, 'image', MAX_IMAGE_BYTES)
  if (!check.ok) return { error: check.error }
  const admin = createAdminClient()
  const path = `employers/${ownerKey.replace(':', '-')}/${kind}-${crypto.randomUUID()}.${check.ext}`
  const { error } = await admin.storage.from('coach-logos').upload(path, file, { contentType: check.contentType })
  if (error) return { error: `The ${kind} picture could not be uploaded. Try again.` }
  return admin.storage.from('coach-logos').getPublicUrl(path).data.publicUrl
}

export type SaveBrandResult = { ok: true; changed: { logo: boolean; office: boolean; product: boolean } } | { ok: false; error: string }

// Saves what the form sent: uploaded pictures replace the old ones, a ticked "remove" clears one, and the two text fields
// are set as typed (blank clears them).
export async function saveEmployerBrand(ownerKey: string, formData: FormData, by: string | null): Promise<SaveBrandResult> {
  const data: Record<string, string | null> = {}
  const changed = { logo: false, office: false, product: false }
  for (const kind of Object.keys(IMAGE_FIELDS) as ImageField[]) {
    const up = await uploadBrandImage(ownerKey, formData.get(kind) as File | null, kind)
    if (up && typeof up === 'object') return { ok: false, error: up.error }
    if (up) {
      data[IMAGE_FIELDS[kind]] = up
      changed[kind] = true
    } else if (formData.get(`remove-${kind}`) === 'on') {
      data[IMAGE_FIELDS[kind]] = null
      changed[kind] = true
    }
  }
  const tagline = cleanBrandText(formData.get('tagline'), 120)
  const productName = cleanBrandText(formData.get('productName'), 80)
  if (tagline === undefined || productName === undefined) return { ok: false, error: 'Keep the tagline under 120 characters and the product name under 80.' }
  data.tagline = tagline
  data.productName = productName
  await prisma.employerBrand.upsert({ where: { ownerKey }, create: { ownerKey, ...data, updatedBy: by }, update: { ...data, updatedBy: by } })
  return { ok: true, changed }
}
