// Autosave-and-resume for the guided Resume Walkthrough — same one-JSON-
// blob-plus-pointer idiom as saveReferenceDraft (src/app/ref/[token]/
// actions.ts): one row per candidate (ResumeWalkthroughSession), a
// currentStep pointer, and a stepAnswers blob updated on every "Next."

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildScreenPlan } from './screen-plan'
import type { WalkthroughScreen, WalkthroughStepAnswers } from './types'

export interface WalkthroughSessionState {
  currentStep: number
  screenPlan: WalkthroughScreen[]
  stepAnswers: WalkthroughStepAnswers
  completedAt: Date | null
}

function parseStepAnswers(json: Prisma.JsonValue): WalkthroughStepAnswers {
  if (json && typeof json === 'object' && !Array.isArray(json)) return json as WalkthroughStepAnswers
  return {}
}

export async function getOrCreateWalkthroughSession(candidateId: string): Promise<WalkthroughSessionState> {
  const existing = await prisma.resumeWalkthroughSession.findUnique({ where: { candidateId } })
  if (existing) {
    const stepAnswers = parseStepAnswers(existing.stepAnswers)
    return {
      currentStep: existing.currentStep,
      screenPlan: stepAnswers.screenPlan ?? [],
      stepAnswers,
      completedAt: existing.completedAt,
    }
  }

  const screenPlan = await buildScreenPlan(candidateId)
  const stepAnswers: WalkthroughStepAnswers = { screenPlan }
  await prisma.resumeWalkthroughSession.create({
    data: { candidateId, currentStep: 0, stepAnswers: stepAnswers as unknown as Prisma.InputJsonValue },
  })
  return { currentStep: 0, screenPlan, stepAnswers, completedAt: null }
}

// Explicit "start over" — recomputes the screen plan from scratch (picking
// up any findings/detections created since, e.g. by a newer resume upload)
// and clears all prior progress. Never called implicitly on a plain page
// visit; only from the review-summary screen's "Start a new walkthrough"
// action once completedAt is already set.
export async function restartWalkthroughSession(candidateId: string): Promise<WalkthroughSessionState> {
  const screenPlan = await buildScreenPlan(candidateId)
  const stepAnswers: WalkthroughStepAnswers = { screenPlan }
  await prisma.resumeWalkthroughSession.upsert({
    where: { candidateId },
    create: { candidateId, currentStep: 0, stepAnswers: stepAnswers as unknown as Prisma.InputJsonValue },
    update: {
      currentStep: 0,
      stepAnswers: stepAnswers as unknown as Prisma.InputJsonValue,
      completedAt: null,
      startedAt: new Date(),
    },
  })
  return { currentStep: 0, screenPlan, stepAnswers, completedAt: null }
}

export interface UpdateWalkthroughResult extends WalkthroughSessionState {
  justCompleted: boolean
}

// The one write path every walkthrough action funnels through: merges
// `patch` into the persisted stepAnswers blob and, when `nextStep` is
// given, advances currentStep to at most that step (never backward — the
// resume-where-you-left-off pointer always reflects the furthest point
// reached, even if the candidate is currently viewing an earlier, already-
// completed screen). Setting completedAt happens exactly once, the first
// time nextStep lands on the plan's 'review' screen.
export async function updateWalkthroughSession(
  candidateId: string,
  patch: Partial<WalkthroughStepAnswers>,
  nextStep?: number
): Promise<UpdateWalkthroughResult> {
  const current = await getOrCreateWalkthroughSession(candidateId)

  const merged: WalkthroughStepAnswers = {
    ...current.stepAnswers,
    ...patch,
    mechanicalHandled: { ...current.stepAnswers.mechanicalHandled, ...patch.mechanicalHandled },
    bulletDrafts: { ...current.stepAnswers.bulletDrafts, ...patch.bulletDrafts },
    bulletsHandled: { ...current.stepAnswers.bulletsHandled, ...patch.bulletsHandled },
    reviewerHandled: { ...current.stepAnswers.reviewerHandled, ...patch.reviewerHandled },
    // Never overwritten after the session is created.
    screenPlan: current.screenPlan,
  }

  const landsOnReview = nextStep !== undefined && current.screenPlan[nextStep]?.kind === 'review'
  const justCompleted = landsOnReview && !current.completedAt

  const updated = await prisma.resumeWalkthroughSession.update({
    where: { candidateId },
    data: {
      stepAnswers: merged as unknown as Prisma.InputJsonValue,
      ...(nextStep !== undefined ? { currentStep: Math.max(current.currentStep, nextStep) } : {}),
      ...(justCompleted ? { completedAt: new Date() } : {}),
    },
  })

  return {
    currentStep: updated.currentStep,
    screenPlan: current.screenPlan,
    stepAnswers: merged,
    completedAt: updated.completedAt,
    justCompleted,
  }
}
