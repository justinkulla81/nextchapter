'use server'

// Institution portal actions: the demo "Preview as" and "Reset demo data"
// controls (nc_admin on a demo tenant only) and View-as on a real tenant
// (nc_admin only, logged with a reason). Each re-resolves access on the
// server; the buttons being hidden is not the protection.

import { WorkspaceAccessError } from '@/lib/higher-ed/resolve'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getInstitutionAccess, requireWorkspace, DEMO_PREVIEW_COOKIE } from '@/lib/higher-ed/access'
import { institutionEntitlements, lockedReason } from '@/lib/plans/entitlements'
import { AUDIENCE_LABELS, customOfferingsFrom, getService, isTargeted, MOMENT_LABELS, NO_TARGETING, PRICING_LABELS, type Audience, type Moment, type Pricing, type ServiceSetting, type Targeting } from '@/lib/higher-ed/services'
import { parseMajors } from '@/lib/higher-ed/major-groups-shared'
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
  // Services and settings belong to the whole institution, not one school or department.
  if (ctx.units?.length) throw new WorkspaceAccessError(`Whole-institution setting at ${slug}`)
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
  patch: {
    on?: boolean
    audience?: string[]
    ownerOffice?: string
    ownerName?: string | null
    pricing?: string
    linkUrl?: string | null
    provider?: string
    partnerName?: string | null
    targeting?: TargetingInput
    skills?: string | string[]
  },
): Promise<{ error?: string }> {
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { orgType: true, plan: true, enabledFeatures: true } })
  const service = getService(key, orgKindOf(inst?.orgType), inst?.enabledFeatures)
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
    if (!['college', 'nextchapter', 'both', 'partner'].includes(patch.provider)) return { error: 'Pick who provides it.' }
    // The free plan lists the organization's own services (and its partners'); NextChapter's coaching and courses are paid.
    if ((patch.provider === 'nextchapter' || patch.provider === 'both') && !institutionEntitlements({ plan: inst?.plan }).nextchapterServices) return { error: lockedReason('nextchapterServices') }
    if (!service.builtIn && (patch.provider === 'nextchapter' || patch.provider === 'both')) return { error: 'NextChapter doesn’t offer this one; it has to be yours or a partner’s.' }
    clean.provider = patch.provider as ServiceSetting['provider']
  }
  if (patch.partnerName !== undefined) clean.partnerName = patch.partnerName?.trim().slice(0, 80) || null
  if (clean.provider === 'partner' && !clean.partnerName) return { error: 'Name the partner. Members see “From <partner>” on the card.' }
  if (clean.provider === 'partner' && !(patch.linkUrl ?? '').trim()) return { error: 'Add the partner’s link: that’s where the card sends members.' }
  if (patch.skills !== undefined) clean.skills = parseMajors(Array.isArray(patch.skills) ? patch.skills.join(',') : patch.skills)
  if (patch.targeting !== undefined) {
    const t = cleanTargeting(patch.targeting)
    if ('error' in t) return { error: t.error }
    clean.targeting = t.targeting
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
    custom: key.startsWith('x_'),
    ...(patch.on !== undefined ? { on: patch.on } : {}),
    ...(clean.provider ? { provider: clean.provider } : {}),
    ...(clean.skills ? { skillCount: clean.skills.length } : {}),
    ...(clean.targeting
      ? {
          targeted: isTargeted(clean.targeting),
          majorCount: clean.targeting.majors.length,
          schoolCount: clean.targeting.schools.length,
          departmentCount: clean.targeting.departments.length,
          cityCount: clean.targeting.cities.length,
          classYears: !!(clean.targeting.classYearFrom || clean.targeting.classYearTo),
          moments: clean.targeting.moments,
        }
      : {}),
  })
  return {}
}

// What the settings form sends for "Only for": comma-separated text and years.
// Text fields arrive as typed (comma-separated) or already split; years as text or numbers.
export type TargetingInput = {
  majors?: string | string[]
  schools?: string | string[]
  departments?: string | string[]
  cities?: string | string[]
  classYearFrom?: string | number | null
  classYearTo?: string | number | null
  moments?: string[]
}

function cleanTargeting(input: TargetingInput): { targeting: Targeting } | { error: string } {
  const list = (v: string | string[] | undefined) => parseMajors(Array.isArray(v) ? v.join(',') : (v ?? ''))
  const year = (v: string | number | null | undefined) => {
    const s = String(v ?? '').trim()
    if (!s) return null
    const n = Number(s)
    return Number.isInteger(n) && n >= 1900 && n <= new Date().getUTCFullYear() + 6 ? n : NaN
  }
  const from = year(input.classYearFrom)
  const to = year(input.classYearTo)
  if (Number.isNaN(from) || Number.isNaN(to)) return { error: 'Class years must be four-digit years, like 2005.' }
  if (from && to && from > to) return { error: 'The first class year must come before the last.' }
  return {
    targeting: {
      ...NO_TARGETING,
      majors: list(input.majors),
      schools: list(input.schools),
      departments: list(input.departments),
      cities: list(input.cities),
      classYearFrom: from,
      classYearTo: to,
      moments: (input.moments ?? []).filter((m): m is Moment => m in MOMENT_LABELS),
    },
  }
}

// Admin › Services › "Your offerings and partners’": a college adds its own
// program or a partner's product as a card. It starts on, for alumni, with no
// link, so members don't see it until a link is saved.
export async function addOffering(slug: string, input: { name: string; pitch: string }): Promise<{ error?: string; key?: string }> {
  const name = input.name.trim().slice(0, 80)
  const pitch = input.pitch.trim().slice(0, 200)
  if (!name) return { error: 'Name the offering, as members should see it.' }
  if (!pitch) return { error: 'Add one line on what it gives members.' }
  const key = `x_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  let count = 0
  const ctx = await updateEnabledFeatures(slug, (cur) => {
    const list = customOfferingsFrom(cur)
    count = list.length
    return count >= 40 ? cur : { ...cur, customServices: [...list, { key, name, pitch }] }
  })
  if (count >= 40) return { error: 'You have 40 offerings. Remove one you no longer use to add another.' }
  captureServerEvent(ctx.userId, 'he_offering_added', { institutionId: ctx.institution.id, slug, service: key })
  return { key }
}

export async function removeOffering(slug: string, key: string): Promise<{ error?: string }> {
  if (!key.startsWith('x_')) return { error: 'Only offerings you added can be removed. Switch catalog services off instead.' }
  const ctx = await updateEnabledFeatures(slug, (cur) => {
    const services = { ...((cur.services as Record<string, unknown>) ?? {}) }
    delete services[key]
    return { ...cur, services, customServices: customOfferingsFrom(cur).filter((o) => o.key !== key) }
  })
  captureServerEvent(ctx.userId, 'he_offering_removed', { institutionId: ctx.institution.id, slug, service: key })
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
