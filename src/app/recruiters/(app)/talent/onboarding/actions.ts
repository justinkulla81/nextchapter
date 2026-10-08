'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { uploadAvatarFile } from '@/lib/avatar/avatar'
import { canManageFirm, getTalentContext } from '@/lib/recruiter/intake/access'
import { slugify, validateSlug } from '@/lib/recruiter/intake/slug'
import { BRAND_FONTS, BRAND_TONES, isHexColor, normalizeWebsite } from '@/lib/recruiter/brand'
import { FIRM_WEBHOOK_EVENTS, isSafeWebhookUrl, newWebhookSecret, sendTestWebhook } from '@/lib/recruiter/webhooks'
import type { AvatarUploadState } from '@/components/ui/avatar-upload-form'

export type OnboardingFormState = { error?: string; success?: string; secret?: string } | undefined

const str = (fd: FormData, k: string) => ((fd.get(k) as string | null) ?? '').trim()

async function adminCtx() {
  const ctx = await getTalentContext()
  if (!ctx.firm || !canManageFirm(ctx)) return null
  return { ctx, firm: ctx.firm }
}

// Step 1: website and page address.
export async function saveFirmBasics(_prev: OnboardingFormState, fd: FormData): Promise<OnboardingFormState> {
  const a = await adminCtx()
  if (!a) return { error: 'Only a firm admin can change this.' }
  const site = normalizeWebsite(str(fd, 'website'))
  if (!site.ok) return { error: site.message }
  const slug = slugify(str(fd, 'slug'))
  const slugError = validateSlug(slug, { firm: true })
  if (slugError) return { error: `Page address: ${slugError}` }
  if (slug !== a.firm.slug && (await prisma.recruiterFirm.findUnique({ where: { slug } }))) {
    return { error: 'That page address is taken. Try another.' }
  }
  await prisma.recruiterFirm.update({ where: { id: a.firm.id }, data: { website: site.url, slug } })
  captureServerEvent(a.ctx.recruiter.id, 'firm_onboarding_basics_saved', { firmId: a.firm.id, hasWebsite: !!site.url })
  revalidatePath('/recruiters/talent/onboarding')
  return { success: 'Saved.' }
}

// Step 2: color, font, tone.
export async function saveFirmBrand(_prev: OnboardingFormState, fd: FormData): Promise<OnboardingFormState> {
  const a = await adminCtx()
  if (!a) return { error: 'Only a firm admin can change this.' }
  const color = str(fd, 'accentColor')
  const font = str(fd, 'brandFont')
  const tone = str(fd, 'brandTone')
  if (!isHexColor(color)) return { error: 'Pick a color.' }
  if (!(font in BRAND_FONTS)) return { error: 'Pick a font.' }
  if (!(tone in BRAND_TONES)) return { error: 'Pick a background.' }
  await prisma.recruiterFirm.update({ where: { id: a.firm.id }, data: { accentColor: color, brandFont: font, brandTone: tone } })
  captureServerEvent(a.ctx.recruiter.id, 'firm_onboarding_brand_saved', { firmId: a.firm.id, font, tone })
  revalidatePath('/recruiters/talent/onboarding')
  return { success: 'Saved. Your page now uses this look.' }
}

export async function uploadFirmHero(_prev: AvatarUploadState, fd: FormData): Promise<AvatarUploadState> {
  const a = await adminCtx()
  if (!a) return { error: 'Only a firm admin can change this.' }
  const file = fd.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Choose an image first.' }
  const result = await uploadAvatarFile(`${a.firm.id}/hero`, file)
  if (result.error) return { error: result.error }
  await prisma.recruiterFirm.update({ where: { id: a.firm.id }, data: { brandHeroUrl: result.url } })
  captureServerEvent(a.ctx.recruiter.id, 'firm_hero_uploaded', { firmId: a.firm.id })
  revalidatePath('/recruiters/talent/onboarding')
  return undefined
}

export async function removeFirmHero(): Promise<void> {
  const a = await adminCtx()
  if (!a) return
  await prisma.recruiterFirm.update({ where: { id: a.firm.id }, data: { brandHeroUrl: null } })
  revalidatePath('/recruiters/talent/onboarding')
}

// Step 4: webhooks.
export async function saveWebhook(_prev: OnboardingFormState, fd: FormData): Promise<OnboardingFormState> {
  const a = await adminCtx()
  if (!a) return { error: 'Only a firm admin can change this.' }
  const check = isSafeWebhookUrl(str(fd, 'url'))
  if (!check.ok) return { error: check.message }
  const events = FIRM_WEBHOOK_EVENTS.filter((e) => fd.get(`ev_${e}`) === 'on')
  if (events.length === 0) return { error: 'Choose at least one thing to be told about.' }
  const existing = await prisma.firmWebhookEndpoint.count({ where: { firmId: a.firm.id } })
  if (existing >= 3) return { error: 'You can have up to 3 endpoints. Remove one first.' }
  const secret = newWebhookSecret()
  await prisma.firmWebhookEndpoint.create({ data: { firmId: a.firm.id, url: check.url, secret, events } })
  captureServerEvent(a.ctx.recruiter.id, 'firm_webhook_created', { firmId: a.firm.id, events })
  revalidatePath('/recruiters/talent/onboarding')
  return { success: 'Endpoint added. Copy your signing secret now; it is not shown again.', secret }
}

export async function rotateWebhookSecret(endpointId: string, _prev: OnboardingFormState): Promise<OnboardingFormState> {
  const a = await adminCtx()
  if (!a) return { error: 'Only a firm admin can change this.' }
  const secret = newWebhookSecret()
  const res = await prisma.firmWebhookEndpoint.updateMany({ where: { id: endpointId, firmId: a.firm.id }, data: { secret } })
  if (res.count === 0) return { error: 'Endpoint not found.' }
  captureServerEvent(a.ctx.recruiter.id, 'firm_webhook_secret_rotated', { firmId: a.firm.id })
  revalidatePath('/recruiters/talent/onboarding')
  return { success: 'New secret created. Copy it now; the old one no longer works.', secret }
}

export async function testWebhook(endpointId: string, _prev: OnboardingFormState): Promise<OnboardingFormState> {
  const a = await adminCtx()
  if (!a) return { error: 'Only a firm admin can change this.' }
  const ep = await prisma.firmWebhookEndpoint.findFirst({ where: { id: endpointId, firmId: a.firm.id } })
  if (!ep) return { error: 'Endpoint not found.' }
  const result = await sendTestWebhook(ep.id)
  captureServerEvent(a.ctx.recruiter.id, 'firm_webhook_tested', { firmId: a.firm.id, ok: result.ok })
  revalidatePath('/recruiters/talent/onboarding')
  return result.ok ? { success: result.message } : { error: result.message }
}

export async function setWebhookActive(endpointId: string, isActive: boolean): Promise<void> {
  const a = await adminCtx()
  if (!a) return
  await prisma.firmWebhookEndpoint.updateMany({ where: { id: endpointId, firmId: a.firm.id }, data: { isActive } })
  revalidatePath('/recruiters/talent/onboarding')
}

export async function deleteWebhook(endpointId: string): Promise<void> {
  const a = await adminCtx()
  if (!a) return
  await prisma.firmWebhookEndpoint.deleteMany({ where: { id: endpointId, firmId: a.firm.id } })
  captureServerEvent(a.ctx.recruiter.id, 'firm_webhook_deleted', { firmId: a.firm.id })
  revalidatePath('/recruiters/talent/onboarding')
}

// Step 5: finish.
export async function finishOnboarding(): Promise<void> {
  const a = await adminCtx()
  if (!a) redirect('/recruiters/talent')
  await prisma.recruiterFirm.update({ where: { id: a.firm.id }, data: { onboardingCompletedAt: new Date(), onboardingToken: null } })
  captureServerEvent(a.ctx.recruiter.id, 'firm_onboarding_completed', { firmId: a.firm.id })
  redirect('/recruiters/talent')
}
