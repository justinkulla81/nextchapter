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
import { INCOME_NEED_OPTIONS, SWITCHABLE_MAIN, askableInterests, effectiveLevelsOf, mergeInterestLevels, mergeSchoolDetails, mergeSideDetails, parseInterestInput, parseSchoolInput, parseSideInput, previousMainOf } from '@/lib/journey/paths'
import { buyDetailsOf, journeyStageForBuyStage } from '@/lib/journey/buy-business'
import { getParallelPaths, saveParallelPaths } from '@/lib/job-reviews/data'
import { workingNowOf } from '@/lib/journey/intensity'

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

// How long the member could go without new income. Asked once, for every journey (and not at all when we already know from a
// saved cushion); it decides how much of the plan is income and whether interim or fractional work is suggested.
export async function saveIncomeNeed(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const need = String(formData.get('incomeNeed') ?? '')
  if (!INCOME_NEED_OPTIONS.some((o) => o.value === need)) return
  const details = { ...((profile.journeyDetails as Record<string, unknown> | null) ?? {}), incomeNeed: need }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { journeyDetails: details as Prisma.InputJsonValue } })
  const kinds = await getParallelPaths(profile.id)
  captureServerEvent(profile.id, 'income_need_saved', { need, main: effectiveJourney(profile), alreadyEarning: (kinds ?? []).length > 0, source: 'asked' })
  refresh()
}

// Side or part-time work: which kinds (the same answer the job board reads), the hours, what it earns and what it is for.
export async function saveSideWork(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const kinds = await saveParallelPaths(profile.id, formData.getAll('kind').map(String))
  const parsed = parseSideInput({ hours: String(formData.get('hours') ?? ''), income: String(formData.get('income') ?? ''), goal: String(formData.get('goal') ?? '') })
  const existing = (profile.journeyDetails as Record<string, unknown> | null) ?? {}
  const paths = mergeSideDetails(existing, parsed)
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { journeyDetails: { ...existing, paths } as Prisma.InputJsonValue } })
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

// "What else are you thinking about?": one level per thing (curious, researching, doing it) or "not thinking about it".
// Asked once, only about what we do not already know. A path is active only at researching or doing it.
export async function savePathInterests(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const kinds = await getParallelPaths(profile.id)
  const signals = { main: effectiveJourney(profile), journeyDetails: profile.journeyDetails, kinds, workingNow: workingNowOf(profile.journeyDetails), interimInterest: profile.interimConsultingInterest }
  const askable = new Set(askableInterests(signals))
  const raw: Record<string, string | undefined> = {}
  for (const [k, v] of formData.entries()) if (typeof v === 'string') raw[k] = v
  const parsed = Object.fromEntries(Object.entries(parseInterestInput(raw)).filter(([k]) => askable.has(k as never)))
  const existing = (profile.journeyDetails as Record<string, unknown> | null) ?? {}
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { journeyDetails: { ...existing, paths: mergeInterestLevels(existing, parsed) } as Prisma.InputJsonValue } })
  const after = effectiveLevelsOf({ ...signals, journeyDetails: { ...existing, paths: mergeInterestLevels(existing, parsed) } })
  captureServerEvent(profile.id, 'paths_interest_saved', {
    levels: after,
    stated: parsed,
    count: Object.keys(after).length,
    activeCount: Object.values(after).filter((l) => l === 'researching' || l === 'doing').length,
    main: signals.main,
  })
  refresh()
}

// Going back to school: program, full or part time, when it ends and how it is paid for. Saving it also records how serious it is
// when the member has not said (full or part time means they are doing it; a program alone means they are researching it).
export async function saveSchoolDetails(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const parsed = parseSchoolInput({ program: String(formData.get('program') ?? ''), mode: String(formData.get('mode') ?? ''), ends: String(formData.get('ends') ?? ''), funding: String(formData.get('funding') ?? '') })
  const existing = (profile.journeyDetails as Record<string, unknown> | null) ?? {}
  let paths = mergeSchoolDetails(existing, parsed)
  const kinds = await getParallelPaths(profile.id)
  const signals = { main: effectiveJourney(profile), journeyDetails: { ...existing, paths }, kinds, workingNow: workingNowOf(existing), interimInterest: profile.interimConsultingInterest }
  if (!effectiveLevelsOf(signals).school && Object.keys(parsed).length > 0) {
    paths = mergeInterestLevels({ ...existing, paths }, { school: parsed.mode ? 'doing' : 'researching' })
  }
  await prisma.candidateProfile.update({ where: { id: profile.id }, data: { journeyDetails: { ...existing, paths } as Prisma.InputJsonValue } })
  captureServerEvent(profile.id, 'school_details_saved', { mode: parsed.mode ?? null, funding: parsed.funding ?? null, hasProgram: !!parsed.program, ends: parsed.ends ?? null, main: signals.main })
  refresh()
}
