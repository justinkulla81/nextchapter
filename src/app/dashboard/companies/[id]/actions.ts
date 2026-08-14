'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { logCatalogAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  confirmWorkHistoryEntry,
  tagEmployerManually,
} from '@/lib/companies/employment-tagging'
import {
  requestInsiderAsk,
  answerInsiderRequest,
  declineInsiderRequest,
  setCurrentEmployerInsiderOptIn,
} from '@/lib/companies/insider-network'
import { submitCompanyIntel, markIntelHelpful, type IntelType } from '@/lib/companies/company-intel'

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export type ActionFormState = { error?: string } | undefined

// ── 4.1 Contribution gate ───────────────────────────────────────────────

export async function confirmWorkHistoryTag(workHistoryEntryId: string, companyPageId: string): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  const result = await confirmWorkHistoryEntry(profile.id, workHistoryEntryId)
  if (result.ok && result.created) {
    const effort = estimateActionEffort({ actionType: 'EMPLOYER_TAGGED' })
    await logCatalogAction(profile.id, {
      text: 'Tag an employer to unlock the insider network',
      actionType: 'EMPLOYER_TAGGED',
      points: effort.points,
      estimatedMinutes: effort.minutes,
      recurring: true,
    })
    captureServerEvent(profile.id, 'company_employer_tagged', { companyId: result.companyId, source: 'resume' })
  }
  revalidatePath(`/dashboard/companies/${companyPageId}`)
}

export async function tagEmployerManual(
  companyPageId: string,
  _prevState: ActionFormState,
  formData: FormData
): Promise<ActionFormState> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const companyName = (formData.get('companyName') as string | null)?.trim() ?? ''
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const isCurrent = formData.get('isCurrent') === 'on'
  const startDateRaw = formData.get('startDate') as string | null
  const endDateRaw = formData.get('endDate') as string | null

  const result = await tagEmployerManually({
    candidateId: profile.id,
    companyName,
    title,
    startDate: startDateRaw ? new Date(startDateRaw) : null,
    endDate: isCurrent ? null : endDateRaw ? new Date(endDateRaw) : null,
    isCurrent,
  })
  if (!result.ok) return { error: result.error }

  if (result.created) {
    const effort = estimateActionEffort({ actionType: 'EMPLOYER_TAGGED' })
    await logCatalogAction(profile.id, {
      text: 'Tag an employer to unlock the insider network',
      actionType: 'EMPLOYER_TAGGED',
      points: effort.points,
      estimatedMinutes: effort.minutes,
      recurring: true,
    })
    captureServerEvent(profile.id, 'company_employer_tagged', { companyId: result.companyId, source: 'manual' })
  }
  revalidatePath(`/dashboard/companies/${companyPageId}`)
}

// Explicit, separate current-employer insider opt-in (4.2) — always shown
// with the "you may be asked about your own employer" warning in the UI.
export async function optInCurrentEmployerInsider(companyId: string, companyPageId: string): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await setCurrentEmployerInsiderOptIn(profile.id, companyId, true)
  captureServerEvent(profile.id, 'company_current_employer_opt_in', { companyId })
  revalidatePath(`/dashboard/companies/${companyPageId}`)
}

// ── 4.3 The ask ──────────────────────────────────────────────────────────

export async function askInsider(
  companyId: string,
  insiderMemberEmploymentId: string,
  companyPageId: string,
  _prevState: ActionFormState,
  formData: FormData
): Promise<ActionFormState> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const question = (formData.get('question') as string | null) ?? ''
  const result = await requestInsiderAsk(profile.id, companyId, insiderMemberEmploymentId, question)
  if (!result.ok) return { error: result.error }

  captureServerEvent(profile.id, 'insider_ask_sent', { companyId, requestId: result.requestId })
  revalidatePath(`/dashboard/companies/${companyPageId}`)
}

export async function answerInsider(
  requestId: string,
  companyPageId: string,
  _prevState: ActionFormState,
  formData: FormData
): Promise<ActionFormState> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const answer = (formData.get('answer') as string | null) ?? ''
  const result = await answerInsiderRequest(requestId, profile.id, answer)
  if (!result.ok) return { error: result.error }

  const effort = estimateActionEffort({ actionType: 'INSIDER_REQUEST_ANSWERED' })
  await logCatalogAction(profile.id, {
    text: 'Answer an insider request',
    actionType: 'INSIDER_REQUEST_ANSWERED',
    points: effort.points,
    estimatedMinutes: effort.minutes,
    recurring: true,
  })
  captureServerEvent(profile.id, 'insider_ask_answered', { requestId })
  revalidatePath(`/dashboard/companies/${companyPageId}`)
  revalidatePath('/dashboard')
}

// Silent by design — no point award change, no different UI branch for the
// asker (see askerVisibleStatus in insider-network.ts).
export async function declineInsider(requestId: string, companyPageId: string): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  await declineInsiderRequest(requestId, profile.id)
  captureServerEvent(profile.id, 'insider_ask_declined', { requestId })
  revalidatePath(`/dashboard/companies/${companyPageId}`)
}

// ── Company intel ────────────────────────────────────────────────────────

export async function submitIntel(
  companyId: string,
  companyPageId: string,
  _prevState: ActionFormState,
  formData: FormData
): Promise<ActionFormState> {
  const profile = await getProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  const intelType = formData.get('intelType') as IntelType
  const body = (formData.get('body') as string | null) ?? ''
  const roleLevelAtTime = (formData.get('roleLevelAtTime') as string | null)?.trim() || null
  const recencyBucket = (formData.get('recencyBucket') as string | null) || null
  const isAnonymous = formData.get('isAnonymous') !== 'off' // defaults on — checkbox absent from FormData when unchecked

  const result = await submitCompanyIntel({
    companyId,
    contributorCandidateId: profile.id,
    intelType,
    body,
    roleLevelAtTime,
    recencyBucket,
    isAnonymous,
  })
  if (!result.ok) return { error: result.error }

  // Points only for content that actually cleared moderation and published —
  // never for held or removed submissions (see company-intel.ts).
  if (result.published) {
    const effort = estimateActionEffort({ actionType: 'COMPANY_INTEL_CONTRIBUTED' })
    await logCatalogAction(profile.id, {
      text: 'Contribute company intel',
      actionType: 'COMPANY_INTEL_CONTRIBUTED',
      points: effort.points,
      estimatedMinutes: effort.minutes,
      recurring: true,
    })
  }
  captureServerEvent(profile.id, 'company_intel_submitted', {
    companyId,
    intelType,
    published: result.published,
  })
  revalidatePath(`/dashboard/companies/${companyPageId}`)
}

export async function markHelpful(intelId: string, companyPageId: string): Promise<void> {
  const profile = await getProfile()
  if (!profile) return
  const result = await markIntelHelpful(intelId, profile.id)
  if (result.ok && !result.alreadyVoted && result.contributorCandidateId) {
    const effort = estimateActionEffort({ actionType: 'INTEL_HELPFUL' })
    await logCatalogAction(result.contributorCandidateId, {
      text: 'Your company intel was marked helpful',
      actionType: 'INTEL_HELPFUL',
      points: effort.points,
      estimatedMinutes: effort.minutes,
      recurring: true,
    })
    captureServerEvent(profile.id, 'company_intel_marked_helpful', { intelId })
  }
  revalidatePath(`/dashboard/companies/${companyPageId}`)
}
