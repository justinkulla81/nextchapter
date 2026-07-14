'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { commitWeeklySprint, toggleSprintActionCompletion, getMondayOfWeek } from '@/lib/weekly/sprint'
import { estimateActionEffort, sprintPointThresholds } from '@/lib/weekly/action-effort'
import { isSprintEditWindowOpen } from '@/lib/weekly/pt-time'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export type CommitSprintFormState = { error?: string } | undefined

export async function submitWeeklySprint(
  _prevState: CommitSprintFormState,
  formData: FormData
): Promise<CommitSprintFormState> {
  const profile = await getAuthedProfile()
  if (!profile) return { error: 'You need to be logged in to do this.' }

  if (!isSprintEditWindowOpen(getMondayOfWeek(new Date()))) {
    return {
      error: "This week's goals are locked. Editing opens Saturday midnight PT through Monday midnight PT.",
    }
  }

  const count = Number(formData.get('actionCount') ?? 0)
  const actions: { text: string; actionType?: string; points: number; estimatedMinutes: number }[] = []
  let maxPoints = 0

  for (let i = 0; i < count; i++) {
    const text = formData.get(`text_${i}`) as string | null
    if (!text) continue
    const actionType = (formData.get(`actionType_${i}`) as string | null) || undefined
    const isAStandard = formData.get(`isAStandard_${i}`) === 'true'
    const isStretch = formData.get(`isStretch_${i}`) === 'true'
    const effort = estimateActionEffort({ actionType, isAStandard, isStretch })
    maxPoints += effort.points

    if (formData.get(`selected_${i}`) !== 'on') continue
    actions.push({ text, actionType, points: effort.points, estimatedMinutes: effort.minutes })
  }

  const { bThreshold } = sprintPointThresholds(maxPoints)
  const committedPoints = actions.reduce((sum, a) => sum + a.points, 0)

  if (committedPoints < bThreshold) {
    return {
      error: `Commit to at least ${bThreshold} points (a B) to lock in this week's sprint — you're at ${committedPoints}.`,
    }
  }

  await commitWeeklySprint(profile.id, actions)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/sprint')
  redirect('/dashboard')
}

export async function toggleSprintAction(actionIndex: number) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await toggleSprintActionCompletion(profile.id, actionIndex)
  revalidatePath('/dashboard')
}
