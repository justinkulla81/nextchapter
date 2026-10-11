'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { createInstitution, seedDemoContent, updateInstitutionBranding, uploadInstitutionImage as uploadImage } from '@/lib/institution/admin'
import { inviteInstitutionUser } from '@/lib/institution/invite'
import type { InstitutionUserRole } from '@prisma/client'
import { DEMO_TENANTS } from '@/lib/higher-ed/demo-tenants'
import { resetDemoInstitution } from '@/lib/higher-ed/demo-seed'

export type InstitutionFormState = { error?: string; ok?: string } | undefined

const ROLES: InstitutionUserRole[] = [
  'INSTITUTION_ADMIN',
  'CAREER_SERVICES',
  'EMPLOYER_RELATIONS',
  'ALUMNI_RELATIONS',
  'DEVELOPMENT',
  'COACH',
  'FACULTY',
  'EXEC_ED',
]

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
    localCollegeId: get('localCollegeId') || null,
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

export interface CrmCollegeOption {
  id: string
  name: string
  website: string | null
  domain: string | null
  location: string | null
  linkedTo: string | null
}

// Type-ahead for the New college form: the CRM's college list (LocalCollege), matched by name.
export async function searchCrmColleges(query: string): Promise<CrmCollegeOption[]> {
  await requireAdmin()
  const q = query.trim()
  if (q.length < 2) return []
  const rows = await prisma.localCollege.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    orderBy: [{ rank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    take: 8,
    select: { id: true, name: true, website: true, city: true, state: true, crmOrgId: true },
  })
  const orgIds = rows.map((r) => r.crmOrgId).filter((id): id is string => !!id)
  const taken = await prisma.institution.findMany({ where: { crmOrganizationId: { in: orgIds } }, select: { crmOrganizationId: true, name: true } })
  const takenBy = new Map(taken.map((t) => [t.crmOrganizationId, t.name]))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    website: r.website,
    domain: r.website ? r.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase() : null,
    location: [r.city, r.state].filter(Boolean).join(', ') || null,
    linkedTo: r.crmOrgId ? takenBy.get(r.crmOrgId) ?? null : null,
  }))
}

// Demo colleges that have a fixture (src/lib/higher-ed/demo-tenants.ts) can be
// put back to it: fictional members, staff, flags and gifts, then the sample
// alumni jobs and target companies. Same reset as the portal's demo bar.
export async function resetDemoFixture(institutionId: string): Promise<void> {
  const admin = await requireAdmin()
  const inst = await prisma.institution.findUnique({ where: { id: institutionId }, select: { slug: true, isDemo: true } })
  const tenant = inst ? DEMO_TENANTS[inst.slug] : undefined
  if (!inst?.isDemo || !tenant) return
  const result = await prisma.$transaction((tx) => resetDemoInstitution(tx, new Date(), tenant), { timeout: 120_000, maxWait: 20_000 })
  const sample = await seedDemoContent(result.institutionId, admin?.email ?? 'admin')
  captureServerEvent(admin?.email ?? 'admin', 'institution_demo_reset', { institutionId: result.institutionId, slug: inst.slug, members: result.members, ...sample })
  revalidatePath('/support/admin/institutions')
}
