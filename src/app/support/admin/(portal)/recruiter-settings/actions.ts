'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma, RecruiterFeeArrangementType, RecruiterFeedbackEnforcement, RecruiterFirmStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { updateRecruiterSettings } from '@/lib/admin/recruiter-settings'
import { EXPORT_DESTINATIONS } from '@/lib/constants/recruiter-export-destinations'

export type FormState = { error?: string } | undefined

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
