'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import type {
  TrackRecordSizeBand,
  TrackRecordDollarBand,
  TrackRecordTenureBand,
  TrackRecordBoardExposure,
  TrackRecordPnlAccountability,
  TrackRecordGeographicScope,
  TrackRecordReportedToLevel,
} from '@prisma/client'

export type FormState = { error?: string } | undefined

function readInt(formData: FormData, name: string): number | null {
  const raw = formData.get(name)
  return raw ? Number(raw) : null
}

// Retakeable any time, same reasoning as updateSkillsAssessment — a
// candidate's scope facts change as their career does, and Executive
// Dossier/Hiring Manager Notes/Market Reality should reflect the current
// answer, not a stale onboarding-era one.
export async function updateTrackRecord(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const profile = await getOrCreateCandidateProfile(user.id)

  const isPeopleManagerRaw = formData.get('isPeopleManager') as string | null
  const isPeopleManager = isPeopleManagerRaw === 'yes'
  const ledThroughRestructuringRaw = formData.get('ledThroughRestructuring') as string | null

  const data = {
    candidateId: profile.id,
    largestTeamManaged: formData.get('largestTeamManaged') as TrackRecordSizeBand,
    largestOrgIndirect: formData.get('largestOrgIndirect') as TrackRecordSizeBand,
    budgetOwned: formData.get('budgetOwned') as TrackRecordDollarBand,
    approvalAuthority: formData.getAll('approvalAuthority').map(String),
    situationRanking: formData.getAll('situationRanking').map(String),
    mandateClarity: readInt(formData, 'mandateClarity'),
    functionsOwnedOutsideCore: formData.getAll('functionsOwnedOutsideCore').map(String),
    droveOutcomesThroughOthers: readInt(formData, 'droveOutcomesThroughOthers'),
    peopleHiredDirectly: formData.get('peopleHiredDirectly') as TrackRecordSizeBand,
    ledThroughRestructuring: ledThroughRestructuringRaw ? ledThroughRestructuringRaw === 'yes' : null,
    sectorHistory: formData.getAll('sectorHistory').map(String),
    stageHistory: formData.getAll('stageHistory').map(String),
    boardExposure: formData.get('boardExposure') as TrackRecordBoardExposure,
    largestInitiativeScope: formData.get('largestInitiativeScope') as TrackRecordDollarBand,
    longestTenure: formData.get('longestTenure') as TrackRecordTenureBand,
    pnlAccountability: formData.get('pnlAccountability') as TrackRecordPnlAccountability,
    geographicScope: formData.get('geographicScope') as TrackRecordGeographicScope,
    reportedToLevel: formData.get('reportedToLevel') as TrackRecordReportedToLevel,
    accomplishmentToConfirm: (formData.get('accomplishmentToConfirm') as string) || null,
    completedAt: new Date(),
  }

  await prisma.trackRecordResponse.upsert({
    where: { candidateId: profile.id },
    create: data,
    update: data,
  })

  // Writes to the same isPeopleManager field Skills Inventory/Experience
  // used to ask for — those forms no longer ask this question (moved here
  // per spec §4.2 item 16). teamSizeManaged is deliberately NOT written —
  // largestTeamManaged (a band) supersedes it going forward; the legacy raw
  // number stays untouched as a read-only fallback for its existing
  // consumers (see the schema comment on CandidateProfile.teamSizeManaged).
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { isPeopleManager },
  })

  captureServerEvent(profile.id, 'track_record_updated', {})

  if (!profile.trackRecordCompletedAt) {
    const sprint = await getCurrentWeekSprint(profile.id)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'TRACK_RECORD_COMPLETED' })
      await autoCompleteEngagementAction(profile.id, {
        actionType: 'TRACK_RECORD_COMPLETED',
        text: 'Complete your Track Record',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { trackRecordCompletedAt: new Date() },
    })
  }

  revalidatePath('/dashboard/track-record')
  revalidatePath('/dashboard/skills-assessments')
  revalidatePath('/dashboard')
}
