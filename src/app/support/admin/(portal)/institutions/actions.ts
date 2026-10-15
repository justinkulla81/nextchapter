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

// The license: tier (which workspaces open), included seats, term and the
// alumni count it was priced on. Only NextChapter admins set this.
export async function saveCollegeLicense(institutionId: string, _prev: InstitutionFormState, formData: FormData): Promise<InstitutionFormState> {
  const admin = await requireAdmin()
  const get = (k: string) => (formData.get(k) as string | null)?.trim() ?? ''
  const tier = get('tier')
  if (!['CAREER', 'ADVANCEMENT', 'INSTITUTION'].includes(tier)) return { error: 'Pick a tier.' }
  const num = (k: string) => (get(k) === '' ? null : Number(get(k)))
  const seats = num('includedSeats')
  const alumni = num('alumniCount')
  if ((seats !== null && (!Number.isInteger(seats) || seats < 0)) || (alumni !== null && (!Number.isInteger(alumni) || alumni < 0))) return { error: 'Seats and alumni count are whole numbers.' }
  const date = (k: string) => (get(k) ? new Date(`${get(k)}T00:00:00Z`) : null)
  const start = date('licenseStartAt')
  const end = date('licenseEndAt')
  if (start && end && end <= start) return { error: 'The license has to end after it starts.' }
  await prisma.institution.update({
    where: { id: institutionId },
    data: { tier: tier as 'CAREER' | 'ADVANCEMENT' | 'INSTITUTION', includedSeats: seats ?? 0, alumniCount: alumni, licenseStartAt: start, licenseEndAt: end },
  })
  captureServerEvent(admin?.email ?? 'admin', 'institution_license_saved', { institutionId, tier, seats })
  revalidatePath('/support/admin/institutions')
  return { ok: 'License saved. The college sees the new workspaces on its next page load.' }
}

// Remove a college staff seat, or resend an invite nobody has accepted.
export async function removeCollegeStaff(staffId: string): Promise<{ error?: string; message?: string }> {
  const admin = await requireAdmin()
  await prisma.institutionUser.update({ where: { id: staffId }, data: { revokedAt: new Date() } })
  captureServerEvent(admin?.email ?? 'admin', 'institution_staff_removed', { staffId, by: 'nc_admin' })
  revalidatePath('/support/admin/institutions')
  return { message: 'Removed.' }
}

export async function resendCollegeStaffInvite(staffId: string): Promise<{ error?: string; message?: string }> {
  const admin = await requireAdmin()
  const row = await prisma.institutionUser.findUnique({ where: { id: staffId }, select: { invitedEmail: true, role: true, workspace: true, institution: { select: { slug: true } } } })
  if (!row) return { error: 'That invite is gone.' }
  const r = await inviteInstitutionUser({ institutionSlug: row.institution.slug, email: row.invitedEmail, role: row.role, workspace: row.workspace })
  if (r.error) return { error: r.error }
  captureServerEvent(admin?.email ?? 'admin', 'institution_staff_invite_resent', { staffId, by: 'nc_admin' })
  revalidatePath('/support/admin/institutions')
  return { message: 'Sent.' }
}

// The college's local market: one or more states and the counties in each
// (a college near a border serves both sides). Feeds Local market, layoff
// alerts, rapid response and the workforce boards shown to staff.
export async function countiesInState(state: string): Promise<{ key: string; name: string }[]> {
  await requireAdmin()
  const rows = await prisma.countyLabor.findMany({ where: { state: state.toUpperCase() }, orderBy: { name: 'asc' }, select: { name: true, nameKey: true } })
  return rows.map((r) => ({ key: r.nameKey, name: r.name }))
}

export async function saveCollegeRegion(institutionId: string, input: { name: string; areas: { state: string; counties: string[] }[] }): Promise<{ error?: string; message?: string }> {
  const admin = await requireAdmin()
  const name = input.name.trim().slice(0, 120)
  const areas = input.areas
    .map((a) => ({ state: a.state.trim().toUpperCase(), counties: [...new Set(a.counties.map((c) => c.trim().toLowerCase()).filter(Boolean))] }))
    .filter((a) => /^[A-Z]{2}$/.test(a.state))
  if (!name) return { error: 'Name the region, e.g. “Louisville area (KY and IN)”.' }
  if (!areas.length) return { error: 'Add at least one state.' }
  if (areas.some((a) => !a.counties.length)) return { error: 'Pick at least one county in each state.' }
  const current = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { profile: true } })
  const profile = { ...((current.profile as Record<string, unknown> | null) ?? {}) }
  const region = { ...((profile.region as Record<string, unknown> | null) ?? {}), name, state: areas[0].state, counties: areas[0].counties, areas }
  await prisma.institution.update({ where: { id: institutionId }, data: { profile: { ...profile, region } } })
  captureServerEvent(admin?.email ?? 'admin', 'institution_region_saved', { institutionId, states: areas.map((a) => a.state), counties: areas.reduce((n, a) => n + a.counties.length, 0) })
  revalidatePath('/support/admin/institutions')
  return { message: 'Region saved.' }
}
