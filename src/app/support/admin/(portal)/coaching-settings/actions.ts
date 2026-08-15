'use server'

import { revalidatePath } from 'next/cache'
import type { CoachAssignmentMode, Prisma, UnusedHoursPolicy } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { updateCoachingSettings } from '@/lib/admin/coaching-settings'
import { COACHING_ELIGIBLE_PLAN_KEYS } from '@/lib/constants/coaching-eligible-plans'

export type FormState = { error?: string } | undefined

const ASSIGNMENT_MODES: CoachAssignmentMode[] = ['AUTO_MATCH', 'ADMIN_ASSIGN', 'CANDIDATE_CHOICE']
const UNUSED_HOURS_POLICIES: UnusedHoursPolicy[] = ['EXPIRE', 'ROLLOVER', 'REFUND']

function intField(formData: FormData, name: string): number | undefined {
  const raw = (formData.get(name) as string | null)?.trim()
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? Math.round(n) : undefined
}

export async function saveCoachingSettings(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const assignmentMode = formData.get('assignmentMode') as string
  if (!ASSIGNMENT_MODES.includes(assignmentMode as CoachAssignmentMode)) {
    return { error: 'Choose an assignment mode.' }
  }
  const unusedHoursPolicy = formData.get('unusedHoursPolicy') as string
  if (!UNUSED_HOURS_POLICIES.includes(unusedHoursPolicy as UnusedHoursPolicy)) {
    return { error: 'Choose an unused-hours policy.' }
  }

  const sessionsIncludedByPlan: Record<string, number> = {}
  for (const key of COACHING_ELIGIBLE_PLAN_KEYS) {
    const value = intField(formData, `sessionsIncluded_${key}`)
    if (value !== undefined) sessionsIncludedByPlan[key] = value
  }

  const data: Prisma.CoachingSettingsUpdateInput = {
    sessionLengthMinutesDefault: intField(formData, 'sessionLengthMinutesDefault') ?? 50,
    sessionsIncludedByPlan: sessionsIncludedByPlan as Prisma.InputJsonValue,
    coachMaxActiveClients: intField(formData, 'coachMaxActiveClients') ?? 25,
    matchWeightFunctionIndustry: intField(formData, 'matchWeightFunctionIndustry') ?? 0,
    matchWeightSeniorityLevel: intField(formData, 'matchWeightSeniorityLevel') ?? 0,
    matchWeightHighNeedBoost: intField(formData, 'matchWeightHighNeedBoost') ?? 0,
    matchWeightTimezone: intField(formData, 'matchWeightTimezone') ?? 0,
    matchWeightStyle: intField(formData, 'matchWeightStyle') ?? 0,
    matchShortlistSize: intField(formData, 'matchShortlistSize') ?? 3,
    assignmentMode: assignmentMode as CoachAssignmentMode,
    cancellationWindowHours: intField(formData, 'cancellationWindowHours') ?? 24,
    noShowConsumesHour: formData.get('noShowConsumesHour') === 'on',
    lateCancelConsumesHour: formData.get('lateCancelConsumesHour') === 'on',
    unusedHoursPolicy: unusedHoursPolicy as UnusedHoursPolicy,
    responseTimeSlaHoursCore: intField(formData, 'responseTimeSlaHoursCore') ?? 72,
    responseTimeSlaHoursPlus: intField(formData, 'responseTimeSlaHoursPlus') ?? 48,
    responseTimeSlaHoursPremium: intField(formData, 'responseTimeSlaHoursPremium') ?? 24,
    interviewsWithoutOffersThreshold: intField(formData, 'interviewsWithoutOffersThreshold') ?? 8,
    dormancyDaysThreshold: intField(formData, 'dormancyDaysThreshold') ?? 14,
    streakBreakWeeksThreshold: intField(formData, 'streakBreakWeeksThreshold') ?? 2,
    escalationReassignmentPolicy: (formData.get('escalationReassignmentPolicy') as string | null)?.trim() || null,
    sessionRatingPromptEnabled: formData.get('sessionRatingPromptEnabled') === 'on',
    surgeCapacityBenchThreshold: intField(formData, 'surgeCapacityBenchThreshold') ?? null,
  }

  const ratingThresholdRaw = (formData.get('sessionRatingRemovalThreshold') as string | null)?.trim()
  if (ratingThresholdRaw) {
    const n = Number(ratingThresholdRaw)
    if (Number.isNaN(n) || n < 0 || n > 5) return { error: 'Removal threshold must be a rating between 0 and 5.' }
    data.sessionRatingRemovalThreshold = n
  } else {
    data.sessionRatingRemovalThreshold = null
  }

  const actor = admin?.email ?? 'admin'
  await updateCoachingSettings(data, actor)

  captureServerEvent(actor, 'coaching_settings_updated', { assignmentMode, unusedHoursPolicy })

  revalidatePath('/support/admin/coaching-settings')
}
