'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { createOrganization, extendDemoOrganization, resetDemoOrganization, setIntegration, updateOrganizationBrand, type CreateOrganizationResult } from '@/lib/organizations/service'
import { uploadOrganizationLogo } from '@/lib/organizations/logo'
import { isPortalType, type IntegrationKey, type PortalType } from '@/lib/organizations/portals'
import { prisma } from '@/lib/prisma'
import { clearDemoData } from '@/lib/demo/seed'
import { createDemoAccessLink } from '@/lib/demo/access'
import { captureServerEvent } from '@/lib/posthog/server'

const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string).trim() : '')

export async function createOrganizationAction(formData: FormData): Promise<CreateOrganizationResult> {
  const admin = await requireAdmin()
  const portals = formData.getAll('portal').filter((v): v is PortalType => typeof v === 'string' && isPortalType(v))
  const file = formData.get('logo')
  let logoUrl = str(formData, 'logoUrl') || null
  if (file instanceof File && file.size > 0) {
    const up = await uploadOrganizationLogo(`new-${crypto.randomUUID()}`, file)
    if (up && typeof up === 'object') return { ok: false, error: up.error }
    if (typeof up === 'string') logoUrl = up
  }
  const result = await createOrganization(
    {
      name: str(formData, 'name'),
      domain: str(formData, 'domain') || null,
      portals,
      brand: { name: str(formData, 'brandName') || null, logoUrl, accent: str(formData, 'accent') || null },
      mode: str(formData, 'mode') === 'demo' ? 'demo' : 'live',
      contactName: str(formData, 'contactName') || null,
      contactEmail: str(formData, 'contactEmail') || null,
      sourceDealId: str(formData, 'crmOrganizationId') || null,
      demoScenario: str(formData, 'demoScenario') || null,
    },
    admin.email ?? null,
  )
  if (result.ok) revalidatePath('/support/admin/organizations')
  return result
}

export type BrandState = { ok?: boolean; error?: string } | null

export async function updateBrandAction(organizationId: string, _prev: BrandState, formData: FormData): Promise<BrandState> {
  const admin = await requireAdmin()
  const file = formData.get('logo')
  let logoUrl: string | null = str(formData, 'logoUrl') || null
  if (file instanceof File && file.size > 0) {
    const up = await uploadOrganizationLogo(organizationId, file)
    if (up && typeof up === 'object') return { error: up.error }
    if (typeof up === 'string') logoUrl = up
  }
  if (str(formData, 'removeLogo') === 'on') logoUrl = null
  const r = await updateOrganizationBrand(organizationId, { name: str(formData, 'brandName') || null, logoUrl, accent: str(formData, 'accent') || null }, admin.email ?? null)
  if (r.error) return { error: r.error }
  revalidatePath(`/support/admin/organizations/${organizationId}`)
  return { ok: true }
}

export async function toggleIntegrationAction(organizationId: string, key: IntegrationKey, on: boolean): Promise<{ error?: string }> {
  const admin = await requireAdmin()
  const r = await setIntegration(organizationId, key, on, admin.email ?? null)
  revalidatePath(`/support/admin/organizations/${organizationId}`)
  return r
}

// Removes a demo organization and everything it created. Real (live)
// organizations are never deleted here.
export async function deleteDemoOrganizationAction(organizationId: string): Promise<{ error?: string }> {
  await requireAdmin()
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, include: { workspaces: true } })
  if (!org) return { error: 'Organization not found.' }
  if (!org.isDemo) return { error: 'Only demo organizations can be deleted here.' }
  await clearDemoData(org)
  await prisma.organization.delete({ where: { id: organizationId } })
  revalidatePath('/support/admin/organizations')
  return {}
}

export async function resetDemoAction(organizationId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin()
  const r = await resetDemoOrganization(organizationId, admin.email ?? null)
  revalidatePath(`/support/admin/organizations/${organizationId}`)
  return r
}

export async function extendDemoAction(organizationId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin()
  const r = await extendDemoOrganization(organizationId, admin.email ?? null)
  revalidatePath(`/support/admin/organizations/${organizationId}`)
  return r
}

// One-time sign-in link to a sample account of a demo. Logged, because it opens a portal as someone else.
export async function demoAccessLinkAction(organizationId: string, key: string): Promise<{ url?: string; error?: string }> {
  const admin = await requireAdmin()
  const r = await createDemoAccessLink(organizationId, key)
  if (r.url) captureServerEvent(admin.email ?? 'admin', 'demo_access_link_created', { organizationId, key })
  return r
}
