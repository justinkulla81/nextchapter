'use server'

// Institution portal actions: the demo "Preview as" and "Reset demo data"
// controls (nc_admin on a demo tenant only) and View-as on a real tenant
// (nc_admin only, logged with a reason). Each re-resolves access on the
// server; the buttons being hidden is not the protection.

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getInstitutionAccess, requireWorkspace, DEMO_PREVIEW_COOKIE } from '@/lib/higher-ed/access'
import { AUDIENCE_LABELS, getService, PRICING_LABELS, type Audience, type Pricing, type ServiceSetting } from '@/lib/higher-ed/services'
import { DEMO_PERSONAS, demoPersonaTokens, getWorkspace, orgBasePath, orgKindOf, workspacesFor } from '@/lib/higher-ed/workspaces'
import { advanceDemoTime, resetDemoInstitution } from '@/lib/higher-ed/demo-seed'
import { DEMO_TENANTS } from '@/lib/higher-ed/demo-tenants'
import { seedDemoContent } from '@/lib/institution/admin'
import { reseedWorkforceDemo } from '@/lib/workforce/demo'
import { logViewAs } from '@/lib/higher-ed/audit'
import { captureServerEvent } from '@/lib/posthog/server'

async function requireDemoAdmin(slug: string) {
  const access = await getInstitutionAccess(slug)
  if (access === 'signed-out' || !access || !access.isNcAdmin || !access.institution.isDemo) {
    throw new Error('Demo controls are for NextChapter admins on a demo institution.')
  }
  return access
}

export async function setDemoPersona(slug: string, formData: FormData) {
  // An nc_admin on a demo, or a prospect on that demo's guest pass.
  const found = await getInstitutionAccess(slug)
  const access = found !== 'signed-out' && found && found.institution.isDemo && (found.isNcAdmin || found.mode === 'demo-guest') ? found : await requireDemoAdmin(slug)
  const persona = String(formData.get('persona') ?? 'all')
  if (!DEMO_PERSONAS.some((p) => p.key === persona)) throw new Error(`Unknown persona ${persona}`)
  const cookieStore = await cookies()
  cookieStore.set(DEMO_PREVIEW_COOKIE, persona, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  captureServerEvent(access.userId, 'he_demo_persona_changed', { institutionId: access.institution.id, slug, persona })
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: access.institution.id }, select: { tier: true, orgType: true, enabledFeatures: true } })
  const first = workspacesFor(demoPersonaTokens(persona), inst.tier, { wioa: (inst.enabledFeatures as { wioa?: boolean } | null)?.wioa === true }, orgKindOf(inst.orgType))[0]
  redirect(`${orgBasePath(slug, inst.orgType)}${first ? `/${getWorkspace(first)!.homePath}` : ''}`)
}

export async function resetDemoData(slug: string): Promise<{ error?: string; members?: number }> {
  const access = await requireDemoAdmin(slug)
  if (access.institution.orgType !== 'COLLEGE') {
    const r = await reseedWorkforceDemo(slug)
    if ('error' in r) return { error: r.error }
    captureServerEvent(access.userId, 'he_demo_reset', { institutionId: access.institution.id, slug, workforce: true })
    revalidatePath(`/i/${slug}`, 'layout')
    return { members: 150 }
  }
  const tenant = DEMO_TENANTS[slug]
  if (!tenant) return { error: `No demo fixture for "${slug}", so there's nothing to reset it to.` }
  const result = await prisma.$transaction((tx) => resetDemoInstitution(tx, new Date(), tenant), { timeout: 120_000, maxWait: 20_000 })
  // Sample alumni jobs and target companies (NextChapter admin's demo content).
  await seedDemoContent(result.institutionId, access.email ?? 'demo-reset')
  captureServerEvent(access.userId, 'he_demo_reset', { institutionId: result.institutionId, slug, members: result.members })
  revalidatePath(`/i/${slug}`, 'layout')
  return { members: result.members }
}

// "Skip ahead 60 days": quiet periods end as if two months passed, and
// thank-you asks appear for alumni who said the college helped.
export async function skipDemoAhead(slug: string): Promise<{ error?: string; message?: string }> {
  const access = await requireDemoAdmin(slug)
  const r = await advanceDemoTime(access.institution.id, 60)
  captureServerEvent(access.userId, 'he_demo_time_advanced', { institutionId: access.institution.id, days: 60, ...r })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: `Skipped ahead 60 days: ${r.cleared} quiet ${r.cleared === 1 ? 'period' : 'periods'} ended, ${r.gratitudePending} thank-you ${r.gratitudePending === 1 ? 'ask' : 'asks'} now in Development › Signals.` }
}

export async function startViewAs(slug: string, _prev: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  const access = await getInstitutionAccess(slug)
  if (access === 'signed-out' || !access || !access.isNcAdmin || access.institution.isDemo || !access.email) {
    return { error: 'View as is for NextChapter admins on a real institution.' }
  }
  const result = await logViewAs({
    institutionId: access.institution.id,
    adminEmail: access.email,
    reason: String(formData.get('reason') ?? ''),
  })
  if ('error' in result) return result
  captureServerEvent(access.userId, 'he_view_as_started', { institutionId: access.institution.id, slug })
  redirect(orgBasePath(slug, access.institution.orgType))
}

// ── Services (Settings › Services) ──────────────────────────────────────────

async function updateEnabledFeatures(slug: string, patch: (current: Record<string, unknown>) => Record<string, unknown>) {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const current = (row.enabledFeatures ?? {}) as Record<string, unknown>
  await prisma.institution.update({
    where: { id: ctx.institution.id },
    data: { enabledFeatures: patch(current) as Prisma.InputJsonValue },
  })
  revalidatePath(`/i/${slug}`, 'layout')
  return ctx
}

const URL_RE = /^https:\/\/[^\s]+$/

// Admin › Services: one service's switch and settings (product design,
// "Admin screen"). Only the fields sent are changed.
export async function saveService(
  slug: string,
  key: string,
  patch: { on?: boolean; audience?: string[]; ownerOffice?: string; ownerName?: string | null; pricing?: string; linkUrl?: string | null; provider?: string },
): Promise<{ error?: string }> {
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { orgType: true } })
  const service = getService(key, orgKindOf(inst?.orgType))
  if (!service) return { error: 'That service no longer exists. Reload the page.' }
  const clean: Partial<ServiceSetting> = {}
  if (patch.on !== undefined) clean.on = patch.on
  if (patch.audience !== undefined) clean.audience = patch.audience.filter((a): a is Audience => a in AUDIENCE_LABELS)
  if (patch.ownerOffice !== undefined) clean.ownerOffice = patch.ownerOffice.trim().slice(0, 60) || service.defaultOwner
  if (patch.ownerName !== undefined) clean.ownerName = patch.ownerName?.trim().slice(0, 80) || null
  if (patch.pricing !== undefined) {
    if (!(patch.pricing in PRICING_LABELS)) return { error: 'Pick free, paid or donor-funded.' }
    clean.pricing = patch.pricing as Pricing
  }
  if (patch.provider !== undefined) {
    if (!['college', 'nextchapter', 'both'].includes(patch.provider)) return { error: 'Pick who provides it.' }
    if (!service.builtIn && patch.provider !== 'college') return { error: 'NextChapter doesn’t offer this one; it has to be your own.' }
    clean.provider = patch.provider as ServiceSetting['provider']
  }
  if (patch.linkUrl !== undefined) {
    const url = patch.linkUrl?.trim() || null
    if (url && !URL_RE.test(url)) return { error: 'The link must start with https://' }
    clean.linkUrl = url
  }
  const ctx = await updateEnabledFeatures(slug, (cur) => {
    const services = (cur.services as Record<string, Partial<ServiceSetting>>) ?? {}
    return { ...cur, services: { ...services, [key]: { ...(services[key] ?? {}), ...clean } } }
  })
  captureServerEvent(ctx.userId, patch.on !== undefined ? 'he_service_toggled' : 'he_service_settings_saved', {
    institutionId: ctx.institution.id,
    slug,
    service: key,
    ...(patch.on !== undefined ? { on: patch.on } : {}),
  })
  return {}
}

export async function setAnnualCheckInMonth(slug: string, formData: FormData): Promise<void> {
  const month = Number(formData.get('annualMonth'))
  if (!(month >= 1 && month <= 12)) throw new Error('Pick a month')
  const ctx = await updateEnabledFeatures(slug, (cur) => ({
    ...cur,
    checkIns: { ...((cur.checkIns as Record<string, unknown>) ?? {}), annualMonth: month },
  }))
  captureServerEvent(ctx.userId, 'he_annual_checkin_month_set', { institutionId: ctx.institution.id, slug, month })
}
