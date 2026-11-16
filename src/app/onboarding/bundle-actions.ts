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
import { coachWrites, parsePlace, whereYouAreWrites } from '@/lib/onboarding/answers'
import { BUNDLE_ROUTE, journeyOfSituation, validateAnswers, type Answers, type BundleId, type QuestionId } from '@/lib/onboarding/bundles'
import { progressPatch } from '@/lib/onboarding/progress'
import { ENTRY_KEY, entryFromGoalParam, entryOf } from '@/lib/onboarding/resume-rule'
import { DETAILS_PATH } from '@/lib/onboarding/details'
import { NETWORK_COMFORT_VALUES } from '@/lib/onboarding/finish'
import { loadScanStatus, type ScanStatus } from '@/lib/onboarding/scan-counts'
import { ARRIVED_FROM_KEY, arrivedFromDetails, arrivedFromForm } from '@/lib/onboarding/arrived-from'
import { buildRelocation, parseRelocation } from '@/lib/journey/relocation'

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

/** The Where step's "Connect me with <board>" box (BoardConnectOffer). Its value is the board's id. */
const CONNECT_BOARD_FIELD = 'connectBoard'

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
  // Started from a place or workforce-board page: keep the place, its board and the situation picked there, for the Where step.
  const arrived = arrivedFromForm(formData)
  if (arrived) captureServerEvent(candidateId, 'onboarding_arrived_from_place', { candidateId, state: arrived.state, area: arrived.area, boardId: arrived.boardId, pickedSituation: arrived.situation, situation: answers.situation })
  await applyJourneyChange(candidateId, {
    stage: writes.stage,
    details: { ...writes.details, ...(entry ? { [ENTRY_KEY]: entry } : {}), ...(arrived ? { [ARRIVED_FROM_KEY]: arrived } : {}), ...progressPatch(now.journeyDetails, { completed: 'where_you_are' }) },
    source: 'ONBOARDING',
  })
  if (Object.keys(writes.profile).length > 0) await prisma.candidateProfile.update({ where: { id: candidateId }, data: writes.profile })

  bundleDone('where_you_are', candidateId, journey, answers)
  revalidatePath('/onboarding', 'layout')
  redirect(BUNDLE_ROUTE.resume)
}

// O2, for anyone without a résumé to hand. Nobody is required to upload one (see resume-rule.ts): skipping goes on to the
// details step, which asks for a name, an email and optionally LinkedIn instead. Their Market Reality sharpens once a
// résumé is added, and the report's own plan asks for one (market-reality-report.ts).
export async function skipResume(): Promise<void> {
  const candidateId = await requireCandidateId()
  const p = await detailsOf(candidateId)
  const journey = effectiveJourney(p)

  await prisma.candidateProfile.update({ where: { id: candidateId }, data: { resumeStepComplete: true } })
  await applyJourneyChange(candidateId, { details: { resumeSkippedAt: new Date().toISOString() }, source: 'ONBOARDING' })
  captureServerEvent(candidateId, 'onboarding_resume_skipped', { candidateId, journey, flow: 'bundles', marketRealityEntry: entryOf(p.journeyDetails) !== null })
  revalidatePath('/onboarding', 'layout')
  redirect(DETAILS_PATH)
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

  // Arrived from a place or board page. "I'm moving here" plus a yes to moving: that state goes on the member's move list, so its
  // jobs count as within reach (src/lib/journey/relocation.ts). A no keeps whatever was there.
  const arrived = arrivedFromDetails(before.journeyDetails)
  const movingThere = arrived?.situation === 'relocating' && openToRelocation
  const current = parseRelocation(before.journeyDetails, openToRelocation)
  const relocation = movingThere && current.scope !== 'ANYWHERE'
    ? buildRelocation({ scope: 'STATES', states: [...(current.scope === 'STATES' ? current.states ?? [] : []), arrived!.state] })
    : null
  await applyJourneyChange(candidateId, { details: { ...(relocation ? { relocation } : {}), ...progressPatch(before.journeyDetails, { completed: 'where' }) }, source: 'ONBOARDING' })

  // "Connect me with <board>": offered only for the board the page named, and only ticked boxes connect. The board sees an
  // anonymous count; the member decides later, in privacy settings, whether to share their name.
  if (arrived?.boardId && formData.get(CONNECT_BOARD_FIELD) === arrived.boardId) {
    const board = await prisma.workforceBoard.findUnique({ where: { id: arrived.boardId }, select: { id: true, state: true } })
    if (board) {
      await prisma.workforceBoardConnection.upsert({
        where: { candidateId_boardId: { candidateId, boardId: board.id } },
        create: { candidateId, boardId: board.id, source: 'onboarding' },
        update: { status: 'ACTIVE', endedAt: null },
      })
      captureServerEvent(candidateId, 'workforce_board_connected', { candidateId, boardId: board.id, state: board.state, source: 'onboarding', situation: arrived.situation })
    }
  }

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

// The live "how many jobs fit" count under O3 and O4 is /api/onboarding/match-preview (a route, so it never queues in
// front of a Continue: server actions run one at a time per client).

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
