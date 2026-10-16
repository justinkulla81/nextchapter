import 'server-only'
import { randomBytes } from 'crypto'
import type { Organization, OrgWorkspace, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { createInstitution } from '@/lib/institution/admin'
import { createOutplacementOrg } from '@/lib/admin/outplacement-contracts'
import { clearDemoData, seedDemoCollege, seedDemoWorkspace } from '@/lib/demo/seed'
import { sizesFor } from '@/lib/demo/scenarios'
import { normalizeHex, mergeBrand, type PartnerBrand } from '@/lib/partners/brand'
import { INTEGRATIONS, PORTALS, isPortalType, portalMeta, resolveIntegrations, type IntegrationKey, type PortalType } from './portals'
import { slugify, uniqueSlug } from './slug'

// Creating and managing an Organization: one customer, one or many portals.
// A workspace points at the portal's own record, so existing portals keep
// working unchanged. Demo organizations are marked sample data end to end.

const DEMO_DAYS = 30

export interface CreateOrganizationInput {
  name: string
  domain?: string | null
  portals: PortalType[]
  brand?: { name?: string | null; logoUrl?: string | null; accent?: string | null }
  mode: 'live' | 'demo'
  contactName?: string | null
  contactEmail?: string | null
  /** The CRM record this customer came from (an id only; no CRM data is read here). */
  sourceDealId?: string | null
  demoScenario?: string | null
}

export type CreateOrganizationResult =
  | { ok: true; organizationId: string; slug: string; links: Array<{ type: PortalType; label: string; href: string; note: string }> }
  | { ok: false; error: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateCreateInput(input: CreateOrganizationInput): string | null {
  if (!input.name.trim()) return 'Enter the organization’s name.'
  if (input.portals.length === 0) return 'Choose at least one portal.'
  for (const t of input.portals) {
    if (!isPortalType(t)) return 'One of the chosen portals is not recognized.'
    if (!portalMeta(t).available) return `${portalMeta(t).label} is not available to create yet.`
  }
  if (input.brand?.accent && !normalizeHex(input.brand.accent)) return 'Brand color must look like #1d6fb8.'
  if (input.mode === 'live') {
    const needsContact = input.portals.some((t) => t !== 'HIGHER_ED')
    if (needsContact && !(input.contactEmail && EMAIL.test(input.contactEmail.trim()))) return 'Enter the first admin’s email so they can be invited.'
  }
  return null
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
}

export async function createOrganization(input: CreateOrganizationInput, adminEmail: string | null): Promise<CreateOrganizationResult> {
  const invalid = validateCreateInput(input)
  if (invalid) return { ok: false, error: invalid }

  const name = input.name.trim()
  const demo = input.mode === 'demo'
  const accent = normalizeHex(input.brand?.accent ?? null)
  const brandName = input.brand?.name?.trim() || null
  const logoUrl = input.brand?.logoUrl?.trim() || null
  const domain = input.domain?.trim().toLowerCase() || null
  const contactName = input.contactName?.trim() || null
  const contactEmail = input.contactEmail?.trim().toLowerCase() || null

  const taken = new Set((await prisma.organization.findMany({ select: { slug: true } })).map((o) => o.slug))
  const slug = uniqueSlug(name, (s) => taken.has(s))

  if (input.sourceDealId) {
    const linked = await prisma.organization.findUnique({ where: { crmOrganizationId: input.sourceDealId }, select: { id: true } })
    if (linked) return { ok: false, error: 'This CRM record already has an organization.' }
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      domain,
      brandName,
      logoUrl,
      accentColor: accent,
      isDemo: demo,
      isSampleData: demo,
      demoScenario: demo ? input.demoScenario ?? 'Realistic' : null,
      demoExpiresAt: demo ? new Date(Date.now() + DEMO_DAYS * 86_400_000) : null,
      crmOrganizationId: input.sourceDealId ?? null,
      createdBy: adminEmail,
    },
  })

  const links: Array<{ type: PortalType; label: string; href: string; note: string }> = []
  const undo: Array<() => Promise<unknown>> = []
  const demoUserIds: string[] = []
  try {
    for (const type of input.portals) {
      const made = await createWorkspace(org, type, { demo, contactName, contactEmail, domain, undo })
      const ws = await prisma.orgWorkspace.create({
        data: { orgId: org.id, type, refId: made.refId, status: made.pending ? 'PENDING' : 'ACTIVE', inviteEmail: made.inviteEmail ?? null, inviteToken: made.inviteToken ?? null },
      })
      if (demo) demoUserIds.push(...(await seedDemoWorkspace(org, ws)))
      links.push({ type, label: portalMeta(type).label, href: made.href, note: made.note })
    }
    if (demo && demoUserIds.length) {
      await prisma.organization.update({ where: { id: org.id }, data: { features: { demoUserIds } } })
    }
  } catch (error) {
    if (demo) {
      // A demo can hold a lot of rows; remove all of it, not just the portal records.
      const fresh = await prisma.organization.findUnique({ where: { id: org.id }, include: { workspaces: true } })
      if (fresh) await clearDemoData({ ...fresh, features: { demoUserIds } }).catch(() => null)
    } else {
      for (const fn of undo.reverse()) await fn().catch(() => null)
    }
    await prisma.organization.delete({ where: { id: org.id } }).catch(() => null)
    console.error('createOrganization failed:', error)
    return { ok: false, error: error instanceof Error && error.message.startsWith('Could not') ? error.message : 'Something went wrong creating a portal, so nothing was created. Try again.' }
  }

  captureServerEvent(adminEmail ?? 'admin', 'organization_created', {
    organizationId: org.id,
    portals: input.portals,
    mode: input.mode,
    fromCrm: Boolean(input.sourceDealId),
  })
  return { ok: true, organizationId: org.id, slug, links }
}

interface Made {
  refId: string | null
  href: string
  note: string
  pending?: boolean
  inviteEmail?: string
  inviteToken?: string
}

async function createWorkspace(
  org: Organization,
  type: PortalType,
  ctx: { demo: boolean; contactName: string | null; contactEmail: string | null; domain: string | null; undo: Array<() => Promise<unknown>> },
): Promise<Made> {
  const { demo, contactName, contactEmail, domain, undo } = ctx
  const brand = { name: org.brandName, accent: org.accentColor, logoUrl: org.logoUrl }
  const testEmail = (kind: string) => `demo+${org.slug}-${kind}@nextchapter.test`

  switch (type) {
    case 'HIGHER_ED': {
      if (demo) {
        // The college demo engine creates the college itself, with sample data.
        const id = await seedDemoCollege(org, sizesFor(org.demoScenario))
        return { refId: id, href: `/i/${org.slug}`, note: 'Demo college with 200 sample alumni. Use the demo bar inside it to reset, jump ahead or preview as a role.' }
      }
      const r = await createInstitution({
        name: org.name,
        slug: org.slug,
        domains: domain ? [domain] : [],
        programBrandName: brand.name,
        accentColor: brand.accent,
        logoUrl: brand.logoUrl,
        isDemo: demo,
      })
      if ('error' in r) throw new Error(`Could not create the higher-ed portal: ${r.error}`)
      undo.push(() => prisma.institution.delete({ where: { id: r.id } }))
      return { refId: r.id, href: `/i/${org.slug}`, note: demo ? 'Demo college. Load sample data from its page.' : 'Invite staff from the portal’s Staff tab.' }
    }
    case 'OUTPLACEMENT': {
      const email = demo ? testEmail('outplacement') : (contactEmail as string)
      const r = await createOutplacementOrg({ name: org.name, programBrandName: brand.name, primaryContactName: contactName, primaryContactEmail: email, isSampleData: demo })
      undo.push(() => prisma.outplacementEmployerOrg.delete({ where: { id: r.id } }))
      return { refId: r.id, href: '/support/admin/outplacement-contracts', note: 'Add a contract (tier, seats, term), then invite the first admin.' }
    }
    case 'COACH': {
      const email = demo ? testEmail('coach') : (contactEmail as string)
      if (await prisma.coach.findUnique({ where: { workEmail: email }, select: { id: true } })) throw new Error('Could not create the coach workspace: a coach with that email already exists.')
      const coach = await prisma.coach.create({
        data: { fullName: contactName ?? `${org.name} coach`, workEmail: email, firmName: brand.name ?? org.name, focus: 'CAREER', logoUrl: brand.logoUrl, accentColor: brand.accent, isSampleData: demo },
        select: { id: true },
      })
      undo.push(() => prisma.coach.delete({ where: { id: coach.id } }))
      return { refId: coach.id, href: `/support/admin/coaches/${coach.id}`, note: demo ? 'Demo coach record.' : 'They sign up at the coach login with this email to claim it.' }
    }
    case 'RECRUITER': {
      if (await prisma.recruiterFirm.findUnique({ where: { name: org.name }, select: { id: true } })) throw new Error('Could not create the recruiter workspace: a firm with that name already exists.')
      const slug = uniqueSlug(org.name, () => false)
      const token = demo ? null : randomBytes(18).toString('base64url')
      const firm = await prisma.recruiterFirm.create({
        data: {
          name: org.name,
          slug: `${slug}-${org.id.slice(-4)}`,
          logoUrl: brand.logoUrl,
          accentColor: brand.accent,
          status: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedBy: 'organization-create',
          ...(token ? { onboardingToken: token, onboardingContactEmail: contactEmail } : {}),
        },
        select: { id: true },
      })
      undo.push(() => prisma.recruiterFirm.delete({ where: { id: firm.id } }))
      return { refId: firm.id, href: token ? `${appUrl()}/recruiters/start/${token}` : `/support/admin/recruiter-settings`, note: token ? 'Send this link to the firm’s first admin.' : 'Demo firm.' }
    }
    case 'HIRING': {
      if (demo) {
        const profile = await prisma.employerProfile.create({
          data: { userId: `sample-org-${org.slug}-hiring`, companyName: org.name, companyWebsite: domain ? `https://${domain}` : null, contactName: contactName ?? 'Talent team', logoUrl: brand.logoUrl, isSampleData: true },
          select: { id: true },
        })
        undo.push(() => prisma.employerProfile.delete({ where: { id: profile.id } }))
        return { refId: profile.id, href: '/talent', note: 'Demo hiring team.' }
      }
      const token = randomBytes(18).toString('base64url')
      return { refId: null, pending: true, inviteEmail: contactEmail as string, inviteToken: token, href: `${appUrl()}/talent/signup?workspace=${token}`, note: 'Send this link to the hiring lead. They must sign up with the invited email; the workspace goes live then.' }
    }
    case 'WORKFORCE':
      throw new Error('Could not create a workforce board here yet.')
  }
}

export type OrganizationWithWorkspaces = Organization & { workspaces: OrgWorkspace[] }

export async function listOrganizations(): Promise<OrganizationWithWorkspaces[]> {
  return prisma.organization.findMany({ orderBy: { createdAt: 'desc' }, include: { workspaces: true }, take: 200 })
}

export async function getOrganization(id: string): Promise<OrganizationWithWorkspaces | null> {
  return prisma.organization.findUnique({ where: { id }, include: { workspaces: true } })
}

export function ownedTypes(org: { workspaces: Array<{ type: PortalType | string }> }): PortalType[] {
  return org.workspaces.map((w) => w.type as PortalType)
}

export async function updateOrganizationBrand(id: string, brand: { name?: string | null; logoUrl?: string | null; accent?: string | null }, adminEmail: string | null): Promise<{ error?: string }> {
  const accent = brand.accent ? normalizeHex(brand.accent) : null
  if (brand.accent && !accent) return { error: 'Brand color must look like #1d6fb8.' }
  const merged = mergeBrand({ name: brand.name, logoUrl: brand.logoUrl, accent })
  if (brand.logoUrl && !merged.logoUrl) return { error: 'The logo must be an https link or an uploaded image.' }
  await prisma.organization.update({ where: { id }, data: { brandName: merged.name, logoUrl: merged.logoUrl, accentColor: merged.accent } })
  captureServerEvent(adminEmail ?? 'admin', 'organization_brand_updated', { organizationId: id, hasLogo: Boolean(merged.logoUrl), hasColor: Boolean(merged.accent) })
  return {}
}

export async function setIntegration(id: string, key: IntegrationKey, on: boolean, adminEmail: string | null): Promise<{ error?: string }> {
  if (!INTEGRATIONS.some((i) => i.key === key)) return { error: 'Unknown connection.' }
  const org = await prisma.organization.findUnique({ where: { id }, select: { features: true } })
  if (!org) return { error: 'Organization not found.' }
  const features: Prisma.InputJsonObject = { ...(org.features && typeof org.features === 'object' ? (org.features as Prisma.InputJsonObject) : {}), [key]: on }
  await prisma.organization.update({ where: { id }, data: { features } })
  captureServerEvent(adminEmail ?? 'admin', 'organization_integration_toggled', { organizationId: id, key, on })
  return {}
}

/**
 * A hiring lead who signs up with the email an organization invited joins that
 * organization's pending hiring workspace. Matching on the invited email (not a
 * link token) works the same whether they confirm by email or sign in at once.
 */
export async function claimHiringWorkspace(employerProfileId: string, email: string | null | undefined): Promise<boolean> {
  const e = email?.trim().toLowerCase()
  if (!e) return false
  const pending = await prisma.orgWorkspace.findFirst({
    where: { type: 'HIRING', status: 'PENDING', inviteEmail: { equals: e, mode: 'insensitive' } },
    select: { id: true, orgId: true },
  })
  if (!pending) return false
  await prisma.orgWorkspace.update({ where: { id: pending.id }, data: { refId: employerProfileId, status: 'ACTIVE', inviteToken: null } })
  captureServerEvent(employerProfileId, 'organization_workspace_claimed', { organizationId: pending.orgId, type: 'HIRING' })
  return true
}

/** The organization's brand for one portal record, or null if it has none. */
export async function organizationBrandFor(type: PortalType, refId: string): Promise<PartnerBrand | null> {
  const ws = await prisma.orgWorkspace.findFirst({
    where: { type, refId },
    select: { org: { select: { brandName: true, logoUrl: true, accentColor: true } } },
  })
  if (!ws) return null
  const b = mergeBrand({ name: ws.org.brandName, logoUrl: ws.org.logoUrl, accent: ws.org.accentColor })
  return b.name || b.logoUrl || b.accent ? b : null
}

/** Which connections are on for the organization that owns this portal record. */
export async function integrationsFor(type: PortalType, refId: string): Promise<Record<IntegrationKey, boolean> | null> {
  const ws = await prisma.orgWorkspace.findFirst({ where: { type, refId }, select: { org: { select: { features: true, workspaces: { select: { type: true } } } } } })
  if (!ws) return null
  return resolveIntegrations(ws.org.features, ws.org.workspaces.map((w) => w.type as PortalType))
}

export { PORTALS, slugify }

/**
 * Puts a demo back to its starting state: removes everything it created and
 * builds it again at the same size, keeping the organization, its brand and its address.
 */
export async function resetDemoOrganization(id: string, adminEmail: string | null): Promise<{ error?: string }> {
  const org = await prisma.organization.findUnique({ where: { id }, include: { workspaces: true } })
  if (!org) return { error: 'Organization not found.' }
  if (!org.isDemo) return { error: 'Only a demo organization can be reset.' }
  const types = org.workspaces.map((w) => w.type as PortalType)
  await clearDemoData(org)
  await prisma.orgWorkspace.deleteMany({ where: { orgId: id } })
  const fresh = await prisma.organization.update({ where: { id }, data: { features: {}, demoExpiresAt: new Date(Date.now() + DEMO_DAYS * 86_400_000) } })
  const undo: Array<() => Promise<unknown>> = []
  const demoUserIds: string[] = []
  try {
    for (const type of types) {
      const made = await createWorkspace(fresh, type, { demo: true, contactName: null, contactEmail: null, domain: fresh.domain, undo })
      const ws = await prisma.orgWorkspace.create({ data: { orgId: id, type, refId: made.refId, status: made.pending ? 'PENDING' : 'ACTIVE' } })
      demoUserIds.push(...(await seedDemoWorkspace(fresh, ws)))
    }
    await prisma.organization.update({ where: { id }, data: { features: { demoUserIds } } })
  } catch (error) {
    console.error('resetDemoOrganization failed:', error)
    const partial = await prisma.organization.findUnique({ where: { id }, include: { workspaces: true } })
    if (partial) await clearDemoData({ ...partial, features: { demoUserIds } }).catch(() => null)
    return { error: 'The demo could not be rebuilt. Its data was cleared; try Reset again.' }
  }
  captureServerEvent(adminEmail ?? 'admin', 'demo_organization_reset', { organizationId: id, portals: types })
  return {}
}

export async function extendDemoOrganization(id: string, adminEmail: string | null): Promise<{ error?: string }> {
  const org = await prisma.organization.findUnique({ where: { id }, select: { isDemo: true } })
  if (!org?.isDemo) return { error: 'Only a demo organization can be extended.' }
  await prisma.organization.update({ where: { id }, data: { demoExpiresAt: new Date(Date.now() + DEMO_DAYS * 86_400_000) } })
  captureServerEvent(adminEmail ?? 'admin', 'demo_organization_extended', { organizationId: id })
  return {}
}
