'use server'

import { revalidatePath } from 'next/cache'
import type { CoachSessionType } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { COACH_SESSION_TYPES, createRateCardEntry } from '@/lib/admin/coaching-rate-card'

export type FormState = { error?: string } | undefined

// Creates a new versioned rate-card row — never edits or deletes an
// existing one, per Master Build Script §A2.5 ("rates are versioned with
// effective dates ... mid-engagement changes don't apply retroactively").
// A blank coachId sets the default rate for that session type; a chosen
// coachId sets a per-coach override.
export async function createRateCardRow(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const sessionTypeRaw = (formData.get('sessionType') as string | null) ?? ''
  if (!COACH_SESSION_TYPES.includes(sessionTypeRaw as CoachSessionType)) {
    return { error: 'Choose a session type.' }
  }

  const rateDollarsRaw = (formData.get('rateDollars') as string | null)?.trim()
  const rateDollars = rateDollarsRaw ? Number(rateDollarsRaw) : NaN
  if (!rateDollarsRaw || Number.isNaN(rateDollars) || rateDollars <= 0) {
    return { error: 'Enter a valid rate, in dollars.' }
  }

  const effectiveDateRaw = (formData.get('effectiveDate') as string | null)?.trim()
  const effectiveDate = effectiveDateRaw ? new Date(`${effectiveDateRaw}T00:00:00`) : null
  if (!effectiveDate || Number.isNaN(effectiveDate.getTime())) {
    return { error: 'Choose an effective date.' }
  }

  const coachId = (formData.get('coachId') as string | null)?.trim() || null
  const sessionType = sessionTypeRaw as CoachSessionType
  const rateCents = Math.round(rateDollars * 100)
  const actor = admin?.email ?? 'admin'

  await createRateCardEntry({ sessionType, rateCents, effectiveDate, coachId, createdBy: actor })

  captureServerEvent(actor, 'coach_rate_card_entry_created', {
    sessionType,
    coachId,
    rateCents,
    effectiveDate: effectiveDate.toISOString(),
  })

  revalidatePath('/support/admin/coaching-rates')
}
