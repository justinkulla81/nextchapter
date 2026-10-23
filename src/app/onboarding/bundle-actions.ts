'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { NetworkComfortLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyJourneyChange } from '@/lib/journey/apply'
import { effectiveJourney, type JourneyType } from '@/lib/journey/journey'
import { normalizeFunctionValue, normalizeLevelValue, normalizeRemotePreferenceValue } from '@/lib/constants/candidate-profile-normalize'
import type { SituationKey } from '@/lib/constants/onboarding'
import { earlyCareerAudience, yearsForChoice } from '@/lib/early-career/audience'
import { clearResumePrefillMarks } from '@/lib/resume/clear-prefill-marks'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { requireCandidateId } from '@/lib/onboarding/require-candidate'
import { saveSituation } from '@/lib/onboarding/save-situation'
import { coachWrites, matchOverrides, parsePlace, whereYouAreWrites } from '@/lib/onboarding/answers'
import { BUNDLE_ROUTE, journeyOfSituation, validateAnswers, type Answers, type BundleId, type QuestionId } from '@/lib/onboarding/bundles'
import { progressPatch } from '@/lib/onboarding/progress'
import { ENTRY_KEY, entryFromGoalParam, entryOf, resumeRequired } from '@/lib/onboarding/resume-rule'
import { NETWORK_COMFORT_VALUES } from '@/lib/onboarding/finish'
import { loadScanStatus, type ScanStatus } from '@/lib/onboarding/scan-counts'
import { computeMatchState } from '@/lib/personalization/match-compute'

// The server side of the onboarding question bundles (docs/personalization-audit/bundles.md O1 to O5).
// Each action reads its answers from the form by question id, checks them with the same pure rules the
// screen uses (src/lib/onboarding/bundles.ts), writes only what the audit gave that bundle, records the
// bundle as done, fires one PostHog event, and moves on. On an error nothing is cleared: the screen keeps
// the member's answers. No action writes a money field.

export type BundleFormState = { error?: string } | undefined

const FIELDS: QuestionId[] = [
  'situation', 'startTiming', 'lastDayWorked', 'applyTiming', 'moveDriver', 'gapDuration', 'returnDate', 'offering', 'openDays', 'venture',
  'targetRole', 'function', 'level', 'place', 'workSetup', 'relocation', 'pushStyle', 'pace', 'intensity',
]

/** The hidden field the first screen carries when the visitor arrived through a Market Reality link. */
const ENTRY_FIELD = 'entry'

function answersFrom(formData: FormData): Answers {
  const out: Answers = {}
  for (const id of FIELDS) {
    const v = formData.get(id)
    if (typeof v === 'string') out[id] = v.trim()
  }
  return out
}

async function detailsOf(candidateId: string) {
  return prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { journey: true, journeyStage: true, currentJobStatus: true, journeyDetails: true, yearsExperience: true, searchIntensity: true },
  })
}

function bundleDone(bundle: BundleId, candidateId: string, journey: JourneyType | null, answers: Answers) {
  const answered = Object.values(answers).filter((v) => v && v !== '').length
  captureServerEvent(candidateId, 'onboarding_bundle_completed', { candidateId, bundleId: bundle, journey, answered, flow: 'bundles' })
}

// O1. The situation card, one follow-up chosen by journey, and the last day worked for people who were let go.
export async function submitWhereYouAre(_prev: BundleFormState, formData: FormData): Promise<BundleFormState> {
  const candidateId = await requireCandidateId()
  const answers = answersFrom(formData)
  const journey = journeyOfSituation(answers.situation)
  const check = validateAnswers('where_you_are', { journey }, answers)
  if (!check.ok || !journey) return { error: check.message || 'Choose the card that sounds most like you to continue.' }

  const saved = await saveSituation(candidateId, answers.situation as SituationKey)
  if (!saved.ok) return { error: 'Something went wrong saving your answer. Please try again; nothing you chose was lost.' }

  const writes = whereYouAreWrites(journey, answers)
  const now = await detailsOf(candidateId)
  // A Market Reality link (?goal=market-reality) makes the résumé required later; see resume-rule.ts. Kept once set.
  const entry = entryFromGoalParam(String(formData.get(ENTRY_FIELD) ?? '')) ?? entryOf(now.journeyDetails)
  await applyJourneyChange(candidateId, {
    stage: writes.stage,
    details: { ...writes.details, ...(entry ? { [ENTRY_KEY]: entry } : {}), ...progressPatch(now.journeyDetails, { completed: 'where_you_are' }) },
    source: 'ONBOARDING',
  })
  if (Object.keys(writes.profile).length > 0) await prisma.candidateProfile.update({ where: { id: candidateId }, data: writes.profile })

  bundleDone('where_you_are', candidateId, journey, answers)
  revalidatePath('/onboarding', 'layout')
  redirect(BUNDLE_ROUTE.resume)
}

// O2, for members who may skip it (everyone except the unemployed and Market Reality arrivals; see resume-rule.ts).
// Checked here too, not only on the screen, so a required résumé cannot be skipped by posting to this action. They are
// asked to upload one on login instead.
export async function skipResume(): Promise<void> {
  const candidateId = await requireCandidateId()
  const p = await detailsOf(candidateId)
  const journey = effectiveJourney(p)
  if (resumeRequired({ journey, entry: entryOf(p.journeyDetails) })) redirect(BUNDLE_ROUTE.resume)

  await prisma.candidateProfile.update({ where: { id: candidateId }, data: { resumeStepComplete: true } })
  await applyJourneyChange(candidateId, { details: { resumeSkippedAt: new Date().toISOString() }, source: 'ONBOARDING' })
  captureServerEvent(candidateId, 'onboarding_resume_skipped', { candidateId, journey, flow: 'bundles' })
  revalidatePath('/onboarding', 'layout')
  redirect(BUNDLE_ROUTE.aiming)
}

// O3. Level, function and target role, confirmed from the résumé. Years and industries stay as the résumé read them.
export async function submitAiming(_prev: BundleFormState, formData: FormData): Promise<BundleFormState> {
  const candidateId = await requireCandidateId()
  const answers = answersFrom(formData)
  const before = await detailsOf(candidateId)
  const journey = effectiveJourney(before)
  const check = validateAnswers('aiming', { journey }, answers)
  if (!check.ok) return { error: check.message }

  // Option-list values are normalised on write ('DIRECTOR' -> 'Director') — see candidate-profile-normalize.ts.
  const highestLevelReached = normalizeLevelValue(answers.level)
  const primaryFunction = normalizeFunctionValue(answers.function)
  if (!highestLevelReached || !primaryFunction) return { error: 'Choose your function and level from the lists to continue. Your other answers are kept.' }
  const targetRoleType = answers.targetRole?.trim() || null
  // A student with no years from the résumé starts on entry-level jobs, as the classic "Where are you in your career?" did.
  const years = journey === 'STUDENT_NEW_GRAD' && before.yearsExperience == null ? yearsForChoice('new_grad', undefined) : undefined

  const updated = await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      highestLevelReached,
      primaryFunction,
      ...(targetRoleType ? { targetRoleType } : {}),
      ...(years !== undefined ? { yearsExperience: years } : {}),
      onboardingResumeConfirmedAt: new Date(),
    },
    select: { journey: true, journeyStage: true, currentJobStatus: true, highestLevelReached: true, yearsExperience: true, levelRankScore: true, isPivoting: true, resumeLatestJobTitle: true, journeyDetails: true },
  })
  await clearResumePrefillMarks(candidateId, ['primaryFunction', ...(years !== undefined ? (['yearsExperience'] as const) : [])])
  await applyJourneyChange(candidateId, { details: progressPatch(updated.journeyDetails, { completed: 'aiming' }), source: 'ONBOARDING' })

  const audience = earlyCareerAudience(updated)
  if (audience) captureServerEvent(candidateId, 'early_career_journey_selected', { audience, journey: updated.journey, choice: null, educationSaved: false, source: 'onboarding' })
  bundleDone('aiming', candidateId, journey, answers)
  revalidatePath('/onboarding', 'layout')
  redirect(BUNDLE_ROUTE.where)
}

// O4. City and state as one question, work setup, relocation. Setting onboardingLocationConfirmedAt is what tells
// job matching that relocation was asked (src/lib/jobs/requirements.ts), so the relocation answer is required.
export async function submitWhere(_prev: BundleFormState, formData: FormData): Promise<BundleFormState> {
  const candidateId = await requireCandidateId()
  const answers = answersFrom(formData)
  const before = await detailsOf(candidateId)
  const check = validateAnswers('where', { journey: effectiveJourney(before) }, answers)
  if (!check.ok) return { error: check.message }

  const remotePreference = normalizeRemotePreferenceValue(answers.workSetup)
  if (!remotePreference) return { error: 'Choose how you want to work to continue. Your other answers are kept.' }
  const place = parsePlace(answers.place)
  const openToRelocation = answers.relocation === 'yes'

  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      remotePreference,
      openToRelocation,
      // A blank place keeps what the résumé read; it never clears it.
      ...(place.city ? { currentCity: place.city } : {}),
      ...(place.state ? { currentState: place.state } : {}),
      onboardingLocationConfirmedAt: new Date(),
    },
  })
  if (place.city || place.state) await clearResumePrefillMarks(candidateId, ['currentCity', 'currentState'])
  await applyJourneyChange(candidateId, { details: progressPatch(before.journeyDetails, { completed: 'where' }), source: 'ONBOARDING' })

  bundleDone('where', candidateId, effectiveJourney(before), answers)
  revalidatePath('/onboarding', 'layout')
  redirect(BUNDLE_ROUTE.coach)
}

// O5. Push style, pace, and how actively (only for people out of work and looking).
export async function submitCoach(_prev: BundleFormState, formData: FormData): Promise<BundleFormState> {
  const candidateId = await requireCandidateId()
  const answers = answersFrom(formData)
  const before = await detailsOf(candidateId)
  const journey = effectiveJourney(before)
  const check = validateAnswers('coach', { journey }, answers)
  if (!check.ok) return { error: check.message }

  const writes = coachWrites(answers)
  if (Object.keys(writes).length > 0) await prisma.candidateProfile.update({ where: { id: candidateId }, data: writes })
  await applyJourneyChange(candidateId, { details: progressPatch(before.journeyDetails, { completed: 'coach' }), source: 'ONBOARDING' })

  captureServerEvent(candidateId, 'onboarding_coaching_style_chosen', { candidateId, journey, pushStyle: writes.coachingStylePreference ?? null, pace: writes.changePacePreference ?? null, intensity: writes.searchIntensity ?? null })
  bundleDone('coach', candidateId, journey, answers)
  revalidatePath('/onboarding', 'layout')
  // The hub sends them on: coach-invited members give consent first, then the required Google step.
  redirect('/onboarding')
}

// The finish screen's one optional next question. Network comfort is saved the way the classic comfort step saved it
// (the +5 point credit has no sprint to credit before an account exists).
export async function answerNextQuestion(_prev: { saved?: boolean; error?: string } | undefined, formData: FormData): Promise<{ saved?: boolean; error?: string }> {
  const candidateId = await requireCandidateId()
  const value = String(formData.get('value') ?? '')
  if (!NETWORK_COMFORT_VALUES.includes(value)) return { error: 'Choose one of the four answers, or skip this question: it is optional.' }
  const p = await detailsOf(candidateId)
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { networkComfortLevel: value as NetworkComfortLevel, networkComfortBonusAt: new Date(), onboardingComfortConfirmedAt: new Date() },
  })
  captureServerEvent(candidateId, 'onboarding_next_question_answered', { candidateId, questionId: 'networkComfort', value, journey: effectiveJourney(p) })
  return { saved: true }
}

export async function finishBundles(formData: FormData): Promise<void> {
  const candidateId = await requireCandidateId()
  const p = await detailsOf(candidateId)
  await applyJourneyChange(candidateId, { details: progressPatch(p.journeyDetails, { finishedAt: new Date() }), source: 'ONBOARDING' })
  captureServerEvent(candidateId, 'onboarding_finish_continued', {
    candidateId,
    journey: effectiveJourney(p),
    nextQuestionAnswered: formData.get('nextQuestionAnswered') === '1',
  })
  revalidatePath('/onboarding', 'layout')
  // Members who gave a résumé see their starting grade next; everyone else goes on to the welcome.
  const hasResume = (await prisma.resume.count({ where: { candidateId, looksLikeResume: { not: false } } })) > 0
  redirect(hasResume ? '/onboarding/score' : '/onboarding')
}

// The live "how many jobs fit" count under O3 and O4: today's jobs run against the profile with the answers
// on screen, not saved yet. Null counts (no function yet, or matching failed) make the screen say so plainly.
export async function previewMatches(bundle: 'aiming' | 'where', answers: Answers, withBaseline: boolean): Promise<{ baseline: number | null; now: number | null }> {
  try {
    const profile = await getCandidateProfileForUser()
    const count = async (p: typeof profile) => (await computeMatchState(p))?.counts.matches ?? null
    const [baseline, now] = await Promise.all([
      withBaseline ? count(profile) : Promise.resolve(null),
      count({ ...profile, ...matchOverrides(bundle, answers) } as typeof profile),
    ])
    return { baseline, now }
  } catch (error) {
    console.error('Onboarding job count failed:', error)
    return { baseline: null, now: null }
  }
}

// The Google reveal, polled while the first scan runs.
export async function pollScan(): Promise<ScanStatus> {
  const profile = await getCandidateProfileForUser()
  return loadScanStatus(profile.id)
}

export async function completeGoogleReveal(formData: FormData): Promise<void> {
  const candidateId = await requireCandidateId()
  const p = await detailsOf(candidateId)
  const scan = await loadScanStatus(candidateId)
  // "continue" is the button on the found screen; "skip" is the plain link. Either way they move on.
  const outcome = formData.get('outcome') === 'continue' && (scan.gmail || scan.calendar) ? 'connected' : 'skipped'
  await applyJourneyChange(candidateId, { details: progressPatch(p.journeyDetails, { googleRevealAt: new Date() }), source: 'ONBOARDING' })
  captureServerEvent(candidateId, outcome === 'connected' ? 'onboarding_google_reveal_continued' : 'onboarding_google_reveal_skipped', {
    candidateId,
    journey: effectiveJourney(p),
    gmail: scan.gmail,
    calendar: scan.calendar,
    ...scan.counts,
  })
  revalidatePath('/onboarding', 'layout')
  redirect('/onboarding/welcome')
}
