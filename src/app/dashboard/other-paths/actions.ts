'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyJourneyChange } from '@/lib/journey/apply'
import { effectiveJourney, getJourney } from '@/lib/journey/journey'
import { INCOME_NEED_OPTIONS, SWITCHABLE_MAIN, parseSideInput, previousMainOf, sideDetailsOf } from '@/lib/journey/paths'
import { buyDetailsOf, journeyStageForBuyStage } from '@/lib/journey/buy-business'
import { getParallelPaths, saveParallelPaths } from '@/lib/job-reviews/data'

const PAGE = '/dashboard/other-paths'

async function currentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  return getOrCreateCandidateProfile(user.id)
}

function refresh() {
  revalidatePath(PAGE)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/buy-a-business')
}

// How soon the member needs income. Asked once, for every journey; it drives whether interim or fractional work is suggested.
export async function saveIncomeNeed(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const need = String(formData.get('incomeNeed') ?? '')
  if (!INCOME_NEED_OPTIONS.some((o) => o.value === need)) return
  const details = { ...((profile.journeyDetails as Record<string, unknown> | null) ?? {}), incomeNeed: need }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { journeyDetails: details as Prisma.InputJsonValue } })
  const kinds = await getParallelPaths(profile.id)
  captureServerEvent(profile.id, 'income_need_saved', { need, main: effectiveJourney(profile), alreadyEarning: (kinds ?? []).length > 0 })
  refresh()
}

// Side or part-time work: which kinds (the same answer the job board reads), the hours, what it earns and what it is for.
export async function saveSideWork(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const kinds = await saveParallelPaths(profile.id, formData.getAll('kind').map(String))
  const parsed = parseSideInput({ hours: String(formData.get('hours') ?? ''), income: String(formData.get('income') ?? ''), goal: String(formData.get('goal') ?? '') })
  const existing = (profile.journeyDetails as Record<string, unknown> | null) ?? {}
  const alongside = { ...((existing.alongside as Record<string, unknown> | undefined) ?? {}), side: { ...sideDetailsOf(existing), ...parsed } }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { journeyDetails: { ...existing, alongside } as Prisma.InputJsonValue } })
  captureServerEvent(profile.id, 'side_work_saved', { kinds, kindCount: kinds.length, hours: parsed.hours ?? null, income: parsed.income ?? null, goal: parsed.goal ?? null, main: effectiveJourney(profile) })
  refresh()
}

// Make a parallel path the main focus, or go back to the journey the member was on. The main journey sets the weekly plan,
// the menu and the emails; whatever it replaces stays in journeyDetails and shows as a card.
export async function switchMainFocus(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const to = String(formData.get('to') ?? '')
  const from = effectiveJourney(profile)
  if (to === 'BACK') {
    const prev = previousMainOf(profile.journeyDetails)
    if (!prev) return
    await applyJourneyChange(profile.id, { journey: prev, stage: getJourney(prev).defaultStage, source: 'SETTINGS' })
    captureServerEvent(profile.id, 'parallel_path_switched_main', { from, to: prev, direction: 'back' })
  } else if ((SWITCHABLE_MAIN as readonly string[]).includes(to)) {
    if (to === 'BUY_BUSINESS') {
      const buy = buyDetailsOf(profile.journeyDetails)
      const stage = buy.stage ?? 'decide'
      await applyJourneyChange(profile.id, {
        journey: 'BUY_BUSINESS',
        stage: journeyStageForBuyStage(stage),
        details: { buy: { ...buy, stage, startedAt: buy.startedAt ?? new Date().toISOString() } },
        source: 'SETTINGS',
      })
    } else {
      await applyJourneyChange(profile.id, { journey: 'FRACTIONAL', stage: 'STAYING', source: 'SETTINGS' })
    }
    captureServerEvent(profile.id, 'parallel_path_switched_main', { from, to, direction: 'forward' })
  } else {
    return
  }
  refresh()
}
