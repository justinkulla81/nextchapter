'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { saveCultureResponse } from '@/lib/companies/culture-profile'
import { cleanCultureAnswers, cleanCulturePreferences, CULTURE_PREF_KEYS } from '@/lib/companies/culture-survey'

// Insider culture survey + the member's own culture preferences. Structured answers
// only — no free text, so no moderation call and no metered cost.

async function getProfileId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return (await getOrCreateCandidateProfile(user.id)).id
}

export type CultureSaveResult = { ok: true; isCurrent?: boolean; answeredCount: number } | { ok: false; error: string }

export async function submitCultureSurvey(companyId: string, rawAnswers: unknown, companySlug?: string): Promise<CultureSaveResult> {
  const candidateId = await getProfileId()
  if (!candidateId) return { ok: false, error: 'Your session ended. Sign in again, then save your answers.' }
  const answers = cleanCultureAnswers(rawAnswers)
  const answeredCount = Object.keys(answers).length
  if (answeredCount === 0) return { ok: false, error: 'Answer at least one question, then save.' }
  const result = await saveCultureResponse(candidateId, companyId, answers)
  if (!result.ok) return result
  revalidatePath('/dashboard')
  if (companySlug) revalidatePath(`/dashboard/companies/${companySlug}`)
  return { ok: true, isCurrent: result.isCurrent, answeredCount }
}

export async function saveCulturePreferences(rawPrefs: unknown): Promise<CultureSaveResult> {
  const candidateId = await getProfileId()
  if (!candidateId) return { ok: false, error: 'Your session ended. Sign in again, then save your preferences.' }
  const prefs = cleanCulturePreferences(rawPrefs)
  const answeredCount = Object.keys(prefs).length
  if (answeredCount === 0) return { ok: false, error: 'Pick at least one answer (or "No preference"), then save.' }
  const data = Object.fromEntries(CULTURE_PREF_KEYS.map((k) => [k, prefs[k] ?? null]))
  await prisma.candidateCulturePreference.upsert({ where: { candidateId }, create: { candidateId, ...data }, update: data })
  revalidatePath('/dashboard/search-strategy')
  revalidatePath('/dashboard/find-my-job')
  return { ok: true, answeredCount }
}
