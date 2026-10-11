'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { createInstitution, seedDemoContent, updateInstitutionBranding } from '@/lib/institution/admin'
import { inviteInstitutionUser } from '@/lib/institution/invite'
import type { InstitutionUserRole } from '@prisma/client'

export type InstitutionFormState = { error?: string; ok?: string } | undefined

const ROLES: InstitutionUserRole[] = [
  'INSTITUTION_ADMIN',
  'CAREER_SERVICES',
  'EMPLOYER_RELATIONS',
  'ALUMNI_RELATIONS',
  'DEVELOPMENT',
  'VIEWER',
]

const MAX_IMAGE_BYTES = 3 * 1024 * 1024

// Stored in the existing public logo bucket under institutions/<id>/, so a demo's logo
// and hero image are plain public URLs the portal can render.
async function uploadImage(institutionId: string, file: File | null, kind: 'logo' | 'hero'): Promise<string | null | { error: string }> {
  if (!file || file.size === 0) return null
  if (!file.type.startsWith('image/')) return { error: 'The file must be an image.' }
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Images must be under 3MB.' }
  const admin = createAdminClient()
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `institutions/${institutionId}/${kind}-${crypto.randomUUID()}.${ext}`
  const { error } = await admin.storage.from('coach-logos').upload(path, file, { contentType: file.type })
  if (error) return { error: 'The image could not be uploaded. Try again.' }
  return admin.storage.from('coach-logos').getPublicUrl(path).data.publicUrl
}

export async function createCollege(_prev: InstitutionFormState, formData: FormData): Promise<InstitutionFormState> {
  const admin = await requireAdmin()
  const get = (k: string) => (formData.get(k) as string | null)?.trim() || ''

  const created = await createInstitution({
    name: get('name'),
    slug: get('slug'),
    domains: get('domains').split(/[,\s]+/).filter(Boolean),
    programBrandName: get('programBrandName') || null,
    accentColor: get('accentColor') || null,
    tagline: get('tagline') || null,
    isDemo: formData.get('isDemo') === 'on',
  })
  if ('error' in created) return { error: created.error }

  const logo = await uploadImage(created.id, formData.get('logo') as File | null, 'logo')
  const hero = await uploadImage(created.id, formData.get('hero') as File | null, 'hero')
  if (logo && typeof logo === 'object') return { error: logo.error }
  if (hero && typeof hero === 'object') return { error: hero.error }
  if (logo || hero) await updateInstitutionBranding(created.id, { logoUrl: logo ?? undefined, heroImageUrl: hero ?? undefined })

  captureServerEvent(admin?.email ?? 'admin', 'institution_created', { institutionId: created.id, demo: formData.get('isDemo') === 'on' })
  revalidatePath('/support/admin/institutions')
  return { ok: `Created ${get('name')}.` }
}

export async function saveCollegeBranding(institutionId: string, _prev: InstitutionFormState, formData: FormData): Promise<InstitutionFormState> {
  await requireAdmin()
  const get = (k: string) => (formData.get(k) as string | null)?.trim() ?? ''
  const logo = await uploadImage(institutionId, formData.get('logo') as File | null, 'logo')
  const hero = await uploadImage(institutionId, formData.get('hero') as File | null, 'hero')
  if (logo && typeof logo === 'object') return { error: logo.error }
  if (hero && typeof hero === 'object') return { error: hero.error }

  await updateInstitutionBranding(institutionId, {
    programBrandName: get('programBrandName') || null,
    accentColor: get('accentColor') || null,
    tagline: get('tagline') || null,
    ...(logo ? { logoUrl: logo } : {}),
    ...(hero ? { heroImageUrl: hero } : {}),
  })
  revalidatePath('/support/admin/institutions')
  return { ok: 'Saved.' }
}

export async function inviteCollegeStaff(institutionId: string, _prev: InstitutionFormState, formData: FormData): Promise<InstitutionFormState> {
  const admin = await requireAdmin()
  const role = formData.get('role') as InstitutionUserRole
  if (!ROLES.includes(role)) return { error: 'Choose a role.' }
  const institution = await prisma.institution.findUnique({ where: { id: institutionId }, select: { slug: true } })
  if (!institution) return { error: 'College not found.' }

  const result = await inviteInstitutionUser({
    institutionSlug: institution.slug,
    email: (formData.get('email') as string | null) ?? '',
    role,
    fullName: (formData.get('fullName') as string | null)?.trim() || null,
  })
  if (result.error) return { error: result.error }
  captureServerEvent(admin?.email ?? 'admin', 'institution_staff_invited', { institutionId, role })
  revalidatePath('/support/admin/institutions')
  return { ok: 'Invitation sent.' }
}

export async function loadDemoContent(institutionId: string): Promise<void> {
  const admin = await requireAdmin()
  const inst = await prisma.institution.findUnique({ where: { id: institutionId }, select: { isDemo: true } })
  // Sample content is only ever added to a college marked as a demo.
  if (!inst?.isDemo) return
  const r = await seedDemoContent(institutionId, admin?.email ?? 'admin')
  captureServerEvent(admin?.email ?? 'admin', 'institution_demo_seeded', { institutionId, ...r })
  revalidatePath('/support/admin/institutions')
}
