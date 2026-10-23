'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyJourneyChange } from '@/lib/journey/apply'
import { effectiveJourney, effectiveStage } from '@/lib/journey/journey'
import { BUY_FIELDS, buyDetailsOf, buyStageForJourneyStage, isBuyStageKey, journeyStageForBuyStage, parseBuyValue, type BuyDetails, type BuyStageKey } from '@/lib/journey/buy-business'

const PAGE = '/dashboard/buy-a-business'

async function currentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  return getOrCreateCandidateProfile(user.id)
}

// Writes the buy block into journeyDetails, keeping every other key (move driver, funding tags, ...).
async function writeBuy(profileId: string, existing: unknown, buy: BuyDetails) {
  const details = { ...((existing as Record<string, unknown> | null) ?? {}), buy }
  await prisma.candidateProfile.update({ where: { id: profileId }, data: { journeyDetails: details as Prisma.InputJsonValue } })
}

function stageOf(profile: Parameters<typeof effectiveJourney>[0], buy: BuyDetails): BuyStageKey {
  if (buy.stage) return buy.stage
  return effectiveJourney(profile) === 'BUY_BUSINESS' ? buyStageForJourneyStage(effectiveStage(profile)) : 'decide'
}

// Start the buying plan, next to whatever the member is already doing (the default) or as their main journey.
export async function startBuying(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const main = formData.get('main') === '1'
  const buy: BuyDetails = { ...buyDetailsOf(profile.journeyDetails), stage: buyDetailsOf(profile.journeyDetails).stage ?? 'decide', startedAt: new Date().toISOString() }
  await writeBuy(profile.id, profile.journeyDetails, buy)
  if (main) await applyJourneyChange(profile.id, { journey: 'BUY_BUSINESS', stage: journeyStageForBuyStage(buy.stage!), source: 'SETTINGS' })
  captureServerEvent(profile.id, 'buy_business_started', { as: main ? 'main_journey' : 'alongside', fromJourney: effectiveJourney(profile) })
  revalidatePath(PAGE)
  revalidatePath('/dashboard')
}

// Save the profile questions. A blank answer leaves the earlier one alone, so a skip never clears anything.
export async function saveBuyIntake(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const buy: BuyDetails = { ...buyDetailsOf(profile.journeyDetails) }
  const saved: string[] = []
  for (const f of BUY_FIELDS) {
    const raw = f.kind === 'multi' ? formData.getAll(f.key).map(String) : String(formData.get(f.key) ?? '')
    if (f.kind === 'multi' && !formData.has(`${f.key}__shown`)) continue
    if (f.kind !== 'multi' && !formData.has(f.key)) continue
    const v = parseBuyValue(f, raw)
    if (v === null) continue
    ;(buy as Record<string, unknown>)[f.key] = v
    saved.push(f.key)
  }
  if (!buy.stage) buy.stage = 'decide'
  if (!buy.startedAt) buy.startedAt = new Date().toISOString()
  await writeBuy(profile.id, profile.journeyDetails, buy)
  captureServerEvent(profile.id, 'buy_business_intake_saved', {
    fields: saved,
    count: saved.length,
    industries: buy.industries ?? [],
    size: buy.size ?? null,
    cash: buy.cash ?? null,
    financing: buy.financing ?? [],
    involvement: buy.involvement ?? null,
    why: buy.why ?? null,
    ready: buy.ready ?? [],
    stage: buy.stage,
  })
  revalidatePath(PAGE)
  revalidatePath('/dashboard')
}

// Move to another stage of the purchase. When buying is the main journey the shared stage follows.
export async function setBuyStage(formData: FormData): Promise<void> {
  const profile = await currentProfile()
  const to = String(formData.get('stage') ?? '')
  if (!isBuyStageKey(to)) return
  const buy = buyDetailsOf(profile.journeyDetails)
  const from = stageOf(profile, buy)
  const next: BuyDetails = { ...buy, stage: to, startedAt: buy.startedAt ?? new Date().toISOString() }
  await writeBuy(profile.id, profile.journeyDetails, next)
  const main = effectiveJourney(profile) === 'BUY_BUSINESS'
  if (main) await applyJourneyChange(profile.id, { stage: journeyStageForBuyStage(to), source: 'SETTINGS' })
  captureServerEvent(profile.id, 'buy_business_stage_changed', { from, to, mainJourney: main })
  revalidatePath(PAGE)
  revalidatePath('/dashboard')
}

// Make buying the member's main journey (the weekly plan, menu and emails follow it).
export async function makeBuyMainJourney(): Promise<void> {
  const profile = await currentProfile()
  const buy = buyDetailsOf(profile.journeyDetails)
  const stage = stageOf(profile, buy)
  await writeBuy(profile.id, profile.journeyDetails, { ...buy, stage, startedAt: buy.startedAt ?? new Date().toISOString() })
  await applyJourneyChange(profile.id, { journey: 'BUY_BUSINESS', stage: journeyStageForBuyStage(stage), source: 'SETTINGS' })
  captureServerEvent(profile.id, 'buy_business_made_main_journey', { fromJourney: effectiveJourney(profile), stage })
  revalidatePath(PAGE)
  revalidatePath('/dashboard')
}
