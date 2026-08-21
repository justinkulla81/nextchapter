'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { getClientIp } from '@/lib/http/client-ip'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { aiGradeTierPassed, combineCrucibleScores, qaTierPassed, scoreQaSubmission } from '@/lib/crucible/scoring'
import { gradeCrucibleDatasetTask, gradeCruciblePromptTask } from '@/lib/crucible/ai-grading'
import { checkCrucibleAiRateLimit } from '@/lib/crucible/rate-limit'
import { JOB_INTENT_TO_VARIANT, type CrucibleJobIntentKey, type CrucibleVariantKey } from '@/lib/crucible/variants'
import { CRUCIBLE_TIER_ORDER, type CrucibleTierKey, type CrucibleVerdictValue } from '@/lib/crucible/scoring-types'
import type { CrucibleSource } from '@prisma/client'

// Session identity is the row's own id, held in a plain (non-httpOnly-only
// because we don't need JS access, but there's no reason to expose it
// either) cookie — deliberately NOT the onboarding anonymous-Supabase-auth-
// session pattern. That pattern creates a real auth.users + CandidateProfile
// row for every visitor; most Crucible visitors will never become
// NextChapter candidates, and this data is low-stakes (an in-progress
// teaser attempt), so a bearer-token-style session id is the right amount
// of weight. Real account creation only happens later, if someone actually
// converts via /crucible/full or the main site.
const SESSION_COOKIE = 'crucible_session'

// A neutral, non-punitive fallback for the two AI-graded activities — used
// both when the AI call itself fails (see ai-grading.ts) and when a
// candidate is rate-limited (checkCrucibleAiRateLimit). Either way, a
// system-side limit shouldn't cost a real candidate a low score. Scored
// just below the pass threshold on purpose — a system failure shouldn't
// silently unlock harder content the candidate never actually earned.
const AI_GRADE_UNAVAILABLE = {
  score: 50,
  feedback: "We're at capacity for automatic scoring right now — this didn't count against you.",
}

function nextTier(current: CrucibleTierKey): CrucibleTierKey | null {
  const i = CRUCIBLE_TIER_ORDER.indexOf(current)
  return i >= 0 && i < CRUCIBLE_TIER_ORDER.length - 1 ? CRUCIBLE_TIER_ORDER[i + 1] : null
}

async function getAuthedCandidate(): Promise<{ candidateId: string; email: string | null } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.is_anonymous) return null
  const profile = await getOrCreateCandidateProfile(user.id)
  return { candidateId: profile.id, email: user.email ?? profile.email ?? null }
}

export type CrucibleStartResult = { sessionId: string; variant: CrucibleVariantKey; skipEmail: boolean; skipResume: boolean }

export async function startCrucibleSession(source: CrucibleSource, jobIntent: CrucibleJobIntentKey): Promise<CrucibleStartResult> {
  const variant = JOB_INTENT_TO_VARIANT[jobIntent]
  const authed = source === 'NC_NEWGRAD' || source === 'NC_ASSESSMENT' ? await getAuthedCandidate() : null
  const ip = await getClientIp()

  const session = await prisma.crucibleSession.create({
    data: {
      source,
      jobIntent,
      variant,
      candidateId: authed?.candidateId ?? null,
      email: authed?.email ?? null,
      ip,
      state: 'CHALLENGE',
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, session.id, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' })

  captureServerEvent(authed?.candidateId ?? session.id, 'crucible_test_start', { src: source, variant, jobIntent })

  return { sessionId: session.id, variant, skipEmail: !!authed, skipResume: !!authed }
}

async function requireSession(sessionId: string) {
  const cookieStore = await cookies()
  const cookieSessionId = cookieStore.get(SESSION_COOKIE)?.value
  if (cookieSessionId !== sessionId) throw new Error('Session mismatch.')
  const session = await prisma.crucibleSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('Session not found.')
  return session
}

export async function captureCrucibleEmail(sessionId: string, email: string): Promise<void> {
  const session = await requireSession(sessionId)
  await prisma.crucibleSession.update({ where: { id: session.id }, data: { email } })
}

export type SubmitChallengeInput = {
  sessionId: string
  selectedOptionIds: string[]
  verdict: CrucibleVerdictValue
}

// Every "cleared a tier" outcome shares this shape — advanced:true means
// stay on this same activity and render `tier`'s content next; advanced:
// false means this activity is done (at `tier`, whether passed or not) and
// the flow should move to the next activity.
export type TierStepResult = { advanced: boolean; tier: CrucibleTierKey }

// QA judgment — the deterministic activity. Re-scored (cheaply) from these
// same stored inputs at submitCrucibleAiTools time using whichever tier
// they finalized on, rather than persisting an intermediate score here.
export async function submitCrucibleChallenge(input: SubmitChallengeInput): Promise<TierStepResult> {
  const session = await requireSession(input.sessionId)
  if (!session.variant) throw new Error('Session has no variant.')

  const qa = scoreQaSubmission(session.variant, session.qaTier, {
    selectedOptionIds: input.selectedOptionIds,
    verdict: input.verdict,
  })
  const passed = qaTierPassed(qa)
  const next = passed ? nextTier(session.qaTier) : null

  await prisma.crucibleSession.update({
    where: { id: session.id },
    data: {
      selectedOptionIds: input.selectedOptionIds,
      verdict: input.verdict,
      qaTier: next ?? session.qaTier,
      state: next ? 'CHALLENGE' : 'PROMPT_TASK',
    },
  })
  captureServerEvent(session.candidateId ?? session.id, 'crucible_verdict', {
    verdict: input.verdict,
    flagCount: input.selectedOptionIds.length,
    tier: session.qaTier,
    passed,
  })

  return next ? { advanced: true, tier: next } : { advanced: false, tier: session.qaTier }
}

export async function submitCruciblePromptTask(sessionId: string, promptText: string): Promise<TierStepResult> {
  const session = await requireSession(sessionId)
  const allowed = await checkCrucibleAiRateLimit(session.ip)
  const grade = allowed ? await gradeCruciblePromptTask(session.promptTier, promptText) : AI_GRADE_UNAVAILABLE
  const passed = aiGradeTierPassed(grade.score)
  const next = passed ? nextTier(session.promptTier) : null

  await prisma.crucibleSession.update({
    where: { id: session.id },
    data: {
      promptSubmission: promptText,
      promptScore: grade.score,
      promptFeedback: grade.feedback,
      promptTier: next ?? session.promptTier,
      state: next ? 'PROMPT_TASK' : 'DATASET_TASK',
      aiGradeCallCount: allowed ? { increment: 1 } : undefined,
    },
  })
  captureServerEvent(session.candidateId ?? session.id, 'crucible_prompt_task', {
    score: grade.score,
    rateLimited: !allowed,
    tier: session.promptTier,
    passed,
  })

  return next ? { advanced: true, tier: next } : { advanced: false, tier: session.promptTier }
}

export async function submitCrucibleDatasetTask(sessionId: string, analysisText: string): Promise<TierStepResult> {
  const session = await requireSession(sessionId)
  const allowed = await checkCrucibleAiRateLimit(session.ip)
  const grade = allowed ? await gradeCrucibleDatasetTask(session.datasetTier, analysisText) : AI_GRADE_UNAVAILABLE
  const passed = aiGradeTierPassed(grade.score)
  const next = passed ? nextTier(session.datasetTier) : null

  await prisma.crucibleSession.update({
    where: { id: session.id },
    data: {
      datasetSubmission: analysisText,
      datasetScore: grade.score,
      datasetFeedback: grade.feedback,
      datasetTier: next ?? session.datasetTier,
      state: next ? 'DATASET_TASK' : 'TOOLS',
      aiGradeCallCount: allowed ? { increment: 1 } : undefined,
    },
  })
  captureServerEvent(session.candidateId ?? session.id, 'crucible_dataset_task', {
    score: grade.score,
    rateLimited: !allowed,
    tier: session.datasetTier,
    passed,
  })

  return next ? { advanced: true, tier: next } : { advanced: false, tier: session.datasetTier }
}

export type CrucibleResultSummary = {
  score: number
  band: string
  branch: 'PASS' | 'GROWTH'
  fixExplanation: string
  herringExplanation: string
  promptFeedback: string
  datasetFeedback: string
  tiersReached: { qa: CrucibleTierKey; prompt: CrucibleTierKey; dataset: CrucibleTierKey }
}

// Scored here, immediately once AI-tools disclosure lands — that's the
// last input the final score reads (resume, submitted or skipped
// afterward, is never part of scoring — see scoring.ts and its dedicated
// purity test). QA is recomputed here (cheap, deterministic) from the
// selections/verdict stored back in submitCrucibleChallenge, at whichever
// tier the candidate finalized on.
export async function submitCrucibleAiTools(sessionId: string, tools: string[], bestMove: string): Promise<CrucibleResultSummary> {
  const session = await requireSession(sessionId)
  if (!session.variant) throw new Error('Session has no variant.')

  const aiTools = { tools, bestMove }
  const qa = scoreQaSubmission(session.variant, session.qaTier, {
    selectedOptionIds: (session.selectedOptionIds as string[] | null) ?? [],
    verdict: session.verdict ?? 'SHIP',
  })
  const tiersReached = { qa: session.qaTier, prompt: session.promptTier, dataset: session.datasetTier }
  const result = combineCrucibleScores(qa, session.promptScore ?? 0, session.datasetScore ?? 0, aiTools, tiersReached)

  await prisma.crucibleSession.update({
    where: { id: session.id },
    data: {
      aiTools: aiTools as unknown as object,
      score: result.score,
      band: result.band,
      branch: result.branch,
      state: 'RESUME',
    },
  })

  const { getQaContent } = await import('@/lib/crucible/variants')
  const content = getQaContent(session.variant, session.qaTier)

  captureServerEvent(session.candidateId ?? session.id, 'crucible_tools', { tools, used_ai: tools.length > 0 })
  captureServerEvent(session.candidateId ?? session.id, 'crucible_scored', {
    score: result.score,
    band: result.band,
    branch: result.branch,
    defect_found: result.breakdown.defectDetection,
    herring_outcome: result.breakdown.herringOutcome,
    prompt_points: result.breakdown.promptPoints,
    dataset_points: result.breakdown.datasetPoints,
    driver_bonus: result.breakdown.driverBonusEarned,
    qa_tier: tiersReached.qa,
    prompt_tier: tiersReached.prompt,
    dataset_tier: tiersReached.dataset,
  })

  return {
    score: result.score,
    band: result.band,
    branch: result.branch,
    fixExplanation: content.fixExplanation,
    herringExplanation: content.herringExplanation,
    promptFeedback: session.promptFeedback ?? '',
    datasetFeedback: session.datasetFeedback ?? '',
    tiersReached,
  }
}

export async function submitCrucibleResume(sessionId: string, file: File | null): Promise<void> {
  const session = await requireSession(sessionId)

  let filePath: string | null = null
  let fileName: string | null = null
  if (file && file.size > 0) {
    const ext = file.name.split('.').pop() ?? 'pdf'
    const path = `leads/${crypto.randomUUID()}.${ext}`
    const admin = createAdminClient()
    const { error } = await admin.storage.from('crucible-resumes').upload(path, file, { contentType: file.type || undefined })
    if (!error) {
      filePath = path
      fileName = file.name
    }
  }

  await prisma.crucibleSession.update({
    where: { id: session.id },
    data: { resumeFilePath: filePath, resumeFileName: fileName, state: 'SCORED', completedAt: new Date() },
  })

  captureServerEvent(session.candidateId ?? session.id, 'crucible_resume', { uploaded: !!filePath })
}

export async function logCrucibleInterest(sessionId: string, kind: 'FULL' | 'LESSON', email: string): Promise<void> {
  const session = await requireSession(sessionId)
  await prisma.crucibleInterest.create({ data: { sessionId: session.id, kind, email } })
  if (!session.email) {
    await prisma.crucibleSession.update({ where: { id: session.id }, data: { email } })
  }
  captureServerEvent(session.candidateId ?? session.id, 'crucible_interest', { kind })
}

// /crucible/full and /crucible/lesson are also reachable directly (e.g. the
// NC Skills/Assessment section's "Take the lesson" button per build spec
// §2, which never routes through /crucible/test first) — this covers
// interest capture with no prior CrucibleSession on file, using whatever
// session cookie already exists if there is one, or creating a minimal
// session on the spot otherwise. CrucibleInterest always has a real session
// FK either way, matching the schema.
export async function logCrucibleInterestStandalone(kind: 'FULL' | 'LESSON', email: string, source: CrucibleSource): Promise<void> {
  const cookieStore = await cookies()
  const existingSessionId = cookieStore.get(SESSION_COOKIE)?.value
  let session = existingSessionId ? await prisma.crucibleSession.findUnique({ where: { id: existingSessionId } }) : null

  if (!session) {
    const authed = source === 'NC_NEWGRAD' || source === 'NC_ASSESSMENT' ? await getAuthedCandidate() : null
    session = await prisma.crucibleSession.create({
      data: { source, candidateId: authed?.candidateId ?? null, email: authed?.email ?? email },
    })
    cookieStore.set(SESSION_COOKIE, session.id, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' })
  }

  await prisma.crucibleInterest.create({ data: { sessionId: session.id, kind, email } })
  if (!session.email) {
    await prisma.crucibleSession.update({ where: { id: session.id }, data: { email } })
  }
  captureServerEvent(session.candidateId ?? session.id, 'crucible_interest', { kind })
}

export type CrucibleRetryResult = { sessionId: string; variant: CrucibleVariantKey }

const RETRY_WAIT_MS = 24 * 60 * 60 * 1000

// A retry serves a DIFFERENT variant than the one just attempted — there's
// exactly one scenario per discipline today, so "no repeat content" means
// rotating disciplines, not a second copy of the same one. Gated to 24h
// after the original attempt completed (build spec §3/§5, "retry with a
// fresh variant after 24h") — enforced here, server-side, regardless of
// what any UI shows, since a client-side-only gate is trivially bypassable.
export async function retryCrucibleChallenge(previousSessionId: string): Promise<CrucibleRetryResult> {
  const previous = await requireSession(previousSessionId)
  if (previous.completedAt && Date.now() - previous.completedAt.getTime() < RETRY_WAIT_MS) {
    throw new Error('You can retry with a new challenge 24 hours after your last attempt.')
  }
  const allVariants: CrucibleVariantKey[] = ['CODE', 'MARKETING', 'DATA']
  const nextVariant = allVariants.find((v) => v !== previous.variant) ?? allVariants[0]
  const ip = await getClientIp()

  const session = await prisma.crucibleSession.create({
    data: {
      source: previous.source,
      jobIntent: previous.jobIntent,
      variant: nextVariant,
      candidateId: previous.candidateId,
      email: previous.email,
      ip,
      state: 'CHALLENGE',
      retryOfId: previous.id,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, session.id, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' })

  captureServerEvent(session.candidateId ?? session.id, 'crucible_retry', { previousSessionId, variant: nextVariant })

  return { sessionId: session.id, variant: nextVariant }
}
