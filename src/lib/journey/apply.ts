// Every journey or stage change goes through here: onboarding, the
// "Has anything changed?" check-in, the Saturday email, the settings select,
// the Offer Bonus claim, a college portal action. One place records history,
// keeps currentJobStatus in step for older readers, and tells the member's
// colleges (laid off → in transition, do-not-solicit; landed → grace period).

import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { graceDaysFrom, openTransitionFlag, placeOpenFlag } from '@/lib/higher-ed/transition'
import { effectiveJourney, effectiveStage, getJourney, type JourneyStage, type JourneyType } from './journey'
import type { JourneyChangeSource } from '@prisma/client'
import { appliesAcrossAffiliations } from '@/lib/affiliations/visibility'

export type JourneyChange = {
  journey?: JourneyType
  stage?: JourneyStage
  details?: Record<string, unknown>
  source: JourneyChangeSource
  note?: string
  // A check-in answer counts as checking in even when nothing changes.
  isCheckIn?: boolean
}

export async function applyJourneyChange(candidateId: string, requested: JourneyChange, now = new Date()) {
  // One affiliation can't silence the others: a college's "no longer looking"
  // is that college's own status (src/lib/affiliations/visibility.ts).
  const change =
    requested.source === 'COLLEGE' && !appliesAcrossAffiliations('COLLEGE', { stage: requested.stage, journey: requested.journey })
      ? { ...requested, stage: undefined, journey: undefined }
      : requested
  const p = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { journey: true, journeyStage: true, currentJobStatus: true, journeyDetails: true },
  })
  const fromJourney = effectiveJourney(p)
  const fromStage = effectiveStage(p)
  const toJourney = change.journey ?? fromJourney
  // A new journey starts at its own default stage unless one was given.
  const toStage = change.stage ?? (change.journey && change.journey !== fromJourney ? getJourney(change.journey).defaultStage : fromStage)
  const journeyChanged = !!toJourney && toJourney !== fromJourney
  const stageChanged = !!toStage && toStage !== fromStage

  const data: Prisma.CandidateProfileUpdateInput = {}
  if (change.isCheckIn) data.journeyCheckedAt = now
  // Persist the derived values too, so the record stops depending on the mapping.
  if (toJourney && (journeyChanged || !p.journey)) {
    data.journey = toJourney
    if (journeyChanged) {
      data.journeyChangedAt = now
      data.currentJobStatus = getJourney(toJourney).jobStatus
    }
  }
  if (toStage && (stageChanged || !p.journeyStage)) {
    data.journeyStage = toStage
    if (stageChanged) data.journeyStageChangedAt = now
  }
  // Changing careers means pivoting: ranking and the pivot steps read this flag.
  if (journeyChanged && toJourney === 'CAREER_CHANGE') data.isPivoting = true
  if (change.details) data.journeyDetails = { ...((p.journeyDetails as Record<string, unknown>) ?? {}), ...change.details } as Prisma.InputJsonValue
  if (Object.keys(data).length) await prisma.candidateProfile.update({ where: { id: candidateId }, data })

  if (journeyChanged || stageChanged) {
    await prisma.journeyEvent.create({
      data: { candidateId, fromJourney, toJourney, fromStage, toStage, source: change.source, note: change.note ?? null },
    })
    captureServerEvent(candidateId, 'journey_changed', {
      fromJourney,
      toJourney,
      fromStage,
      toStage,
      source: change.source,
      moveDriver: (change.details as { moveDriver?: string } | undefined)?.moveDriver ?? null,
    })
    await tellColleges(candidateId, { journeyChanged, toJourney, stageChanged, toStage, source: change.source, now })
  }
  return { fromJourney, toJourney, fromStage, toStage, journeyChanged, stageChanged }
}

// College alumni only, and only colleges they've joined. College-portal
// actions already did this themselves, so they're skipped here.
async function tellColleges(
  candidateId: string,
  c: { journeyChanged: boolean; toJourney: JourneyType | null; stageChanged: boolean; toStage: JourneyStage | null; source: JourneyChangeSource; now: Date },
) {
  if (c.source === 'COLLEGE') return
  const memberships = await prisma.institutionMember.findMany({
    where: { candidateId, status: { in: ['CLAIMED', 'ACTIVE'] } },
    select: { id: true, institution: { select: { enabledFeatures: true } } },
  })
  for (const m of memberships) {
    if (c.journeyChanged && c.toJourney === 'LAID_OFF') await openTransitionFlag(m.id, 'CHECK_IN')
    if (c.stageChanged && c.toStage === 'LANDED') await placeOpenFlag(m.id, graceDaysFrom(m.institution.enabledFeatures), c.now)
  }
}
