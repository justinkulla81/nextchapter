'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma, RecruiterFeeArrangementType, RecruiterFeedbackEnforcement, RecruiterFirmStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { updateRecruiterSettings } from '@/lib/admin/recruiter-settings'
import { EXPORT_DESTINATIONS } from '@/lib/constants/recruiter-export-destinations'
import { randomBytes } from 'crypto'
import { slugify } from '@/lib/recruiter/intake/slug'
import { normalizeWebsite } from '@/lib/recruiter/brand'

export type FormState = { error?: string } | undefined
export type InviteFirmState = { error?: string; link?: string; firmName?: string } | undefined

const ENFORCEMENT_MODES: RecruiterFeedbackEnforcement[] = ['NONE', 'WARN', 'SUSPEND']
const FIRM_STATUSES: RecruiterFirmStatus[] = ['PENDING', 'VERIFIED', 'SUSPENDED', 'REMOVED']
const FEE_ARRANGEMENT_TYPES: RecruiterFeeArrangementType[] = ['PERCENTAGE_OF_COMP', 'FLAT_FEE', 'RETAINER']

function floatField(formData: FormData, name: string): number | undefined {
  const raw = (formData.get(name) as string | null)?.trim()
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function intField(formData: FormData, name: string): number | undefined {
  const raw = (formData.get(name) as string | null)?.trim()
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? Math.round(n) : undefined
}

export async function saveRecruiterSettings(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const enforcement = formData.get('feedbackSlaEnforcement') as string
  if (!ENFORCEMENT_MODES.includes(enforcement as RecruiterFeedbackEnforcement)) {
    return { error: 'Choose a feedback SLA enforcement mode.' }
  }

  const data: Prisma.RecruiterSettingsUpdateInput = {
    consentExpiryDays: intField(formData, 'consentExpiryDays') ?? 90,
    rankingWeightDossierCompleteness: intField(formData, 'rankingWeightDossierCompleteness') ?? 5,
    feedbackSlaHoursDefault: intField(formData, 'feedbackSlaHoursDefault') ?? 120,
    feedbackSlaEnforcement: enforcement as RecruiterFeedbackEnforcement,
    feedbackNonResponseSuspendThreshold: intField(formData, 'feedbackNonResponseSuspendThreshold') ?? 3,
  }

  const actor = admin?.email ?? 'admin'
  await updateRecruiterSettings(data, actor)
  captureServerEvent(actor, 'recruiter_settings_updated', { feedbackSlaEnforcement: enforcement })

  revalidatePath('/support/admin/recruiter-settings')
}

export async function createRecruiterFirm(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  if (!name) return { error: 'Firm name is required.' }

  const seatCount = intField(formData, 'seatCount') ?? 1
  const accessScope = (formData.get('accessScope') as string | null)?.trim() || null
  const feedbackSlaHours = intField(formData, 'feedbackSlaHours') ?? null
  const exportDestinationsEnabled = EXPORT_DESTINATIONS.filter((d) => formData.get(`export_${d}`) === 'on')

  const actor = admin?.email ?? 'admin'
  const firm = await prisma.recruiterFirm.create({
    data: { name, seatCount, accessScope, feedbackSlaHours, exportDestinationsEnabled },
  })

  captureServerEvent(actor, 'recruiter_firm_created', { firmId: firm.id, name })
  revalidatePath('/support/admin/recruiter-settings')
}

export async function updateRecruiterFirm(firmId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const status = formData.get('status') as string
  if (!FIRM_STATUSES.includes(status as RecruiterFirmStatus)) return { error: 'Choose a status.' }

  const seatCount = intField(formData, 'seatCount') ?? 1
  const accessScope = (formData.get('accessScope') as string | null)?.trim() || null
  const feedbackSlaHours = intField(formData, 'feedbackSlaHours') ?? null
  const notes = (formData.get('notes') as string | null)?.trim() || null
  const exportDestinationsEnabled = EXPORT_DESTINATIONS.filter((d) => formData.get(`export_${d}`) === 'on')

  const feeArrangementTypeRaw = formData.get('feeArrangementType') as string | null
  const feeArrangementType = FEE_ARRANGEMENT_TYPES.includes(feeArrangementTypeRaw as RecruiterFeeArrangementType)
    ? (feeArrangementTypeRaw as RecruiterFeeArrangementType)
    : null
  const feeArrangementPercentage = floatField(formData, 'feeArrangementPercentage') ?? null
  const feeArrangementFlatAmountUsd = intField(formData, 'feeArrangementFlatAmountUsd') ?? null
  const feeArrangementNotes = (formData.get('feeArrangementNotes') as string | null)?.trim() || null

  const actor = admin?.email ?? 'admin'
  const existing = await prisma.recruiterFirm.findUniqueOrThrow({ where: { id: firmId } })

  const data: Prisma.RecruiterFirmUpdateInput = {
    status: status as RecruiterFirmStatus,
    seatCount,
    accessScope,
    feedbackSlaHours,
    notes,
    exportDestinationsEnabled,
    feeArrangementType,
    feeArrangementPercentage,
    feeArrangementFlatAmountUsd,
    feeArrangementNotes,
  }

  if (status === 'VERIFIED' && existing.status !== 'VERIFIED') {
    data.verifiedAt = new Date()
    data.verifiedBy = actor
  }
  if (status === 'SUSPENDED' && existing.status !== 'SUSPENDED') {
    data.suspendedAt = new Date()
    data.suspendedBy = actor
  }

  await prisma.recruiterFirm.update({ where: { id: firmId }, data })
  captureServerEvent(actor, 'recruiter_firm_updated', { firmId, status })

  revalidatePath('/support/admin/recruiter-settings')
}

// NextChapter Talent master switch for sending recruiter-approved replies.
// Off until counsel confirms NYC Local Law 144 treatment of pre-scan; the
// change goes through updateRecruiterSettings so it lands in the change log.
export async function setIntakeAutoRepliesEnabled(enabled: boolean): Promise<void> {
  const admin = await requireAdmin()
  const actor = admin?.email ?? 'admin'
  await updateRecruiterSettings({ intakeAutoRepliesEnabled: enabled }, actor)
  captureServerEvent(actor, 'talent_reply_sending_toggled', { enabled })
  revalidatePath('/support/admin/recruiter-settings')
}

// A shareable registration link for one firm. Creates the firm (or reuses an
// empty one with the same name), keeps a one-time token on it, and returns
// /recruiters/start/<token>. Whoever opens it first and signs up becomes the
// firm's admin and lands in the setup wizard. The token stops working once
// the firm has a member.
export async function inviteFirmToRegister(_prev: InviteFirmState, formData: FormData): Promise<InviteFirmState> {
  const admin = await requireAdmin()
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  if (!name) return { error: 'Enter the firm name.' }
  const site = normalizeWebsite((formData.get('website') as string | null) ?? '')
  if (!site.ok) return { error: site.message }
  const contact = ((formData.get('contactEmail') as string | null) ?? '').trim().toLowerCase() || null
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return { error: 'Enter a valid contact email, or leave it blank.' }
  const verified = formData.get('verified') === 'on'

  const existing = await prisma.recruiterFirm.findUnique({ where: { name }, include: { _count: { select: { recruiters: true } } } })
  if (existing && existing._count.recruiters > 0) return { error: 'That firm already has members. Invite people from inside the firm instead.' }

  let slug = slugify(name) || 'firm'
  if (!existing || existing.slug !== slug) {
    let n = 1
    const base = slug
    while (await prisma.recruiterFirm.findUnique({ where: { slug } })) slug = `${base}-${++n}`
  }
  const token = randomBytes(18).toString('base64url')
  const data = {
    website: site.url,
    onboardingToken: token,
    onboardingContactEmail: contact,
    ...(verified ? { status: 'VERIFIED' as RecruiterFirmStatus, verifiedAt: new Date(), verifiedBy: admin?.email ?? 'admin' } : {}),
  }
  const firm = existing
    ? await prisma.recruiterFirm.update({ where: { id: existing.id }, data: { ...data, slug: existing.slug ?? slug } })
    : await prisma.recruiterFirm.create({ data: { name, slug, ...data } })

  captureServerEvent(admin?.email ?? 'admin', 'recruiter_firm_invited_to_register', { firmId: firm.id, verified })
  revalidatePath('/support/admin/recruiter-settings')
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
  return { link: `${base}/recruiters/start/${token}`, firmName: name }
}
