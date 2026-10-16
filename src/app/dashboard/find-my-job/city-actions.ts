'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { US_STATE_CODES } from '@/lib/pay/market-pay'
import { normalizeMetroArea } from '@/lib/constants/metro-areas'
import { clearResumePrefillMarks } from '@/lib/resume/clear-prefill-marks'
import { captureMatchBaseline } from '@/lib/personalization/match-snapshot'

/** Saves the member's home city and state: their board then counts jobs within commuting distance (relevance.ts). */
export async function saveHomeCity(city: string, state: string): Promise<{ ok: boolean; error?: string }> {
  const c = typeof city === 'string' ? city.trim().slice(0, 80) : ''
  const st = typeof state === 'string' ? state.trim().toUpperCase() : ''
  if (!c) return { ok: false, error: 'Enter your city.' }
  if (!US_STATE_CODES.has(st)) return { ok: false, error: 'Pick your state.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  await captureMatchBaseline(profile)
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { currentCity: c, currentState: st, metroArea: normalizeMetroArea(c) } })
  await clearResumePrefillMarks(profile.id, ['currentCity', 'currentState'])
  return { ok: true }
}
