'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { toggleSprintActionCompletion, logCatalogAction } from '@/lib/weekly/sprint'
import { estimateActionEffort, isRecurringActionType } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function toggleSprintAction(actionIndex: number) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await toggleSprintActionCompletion(profile.id, actionIndex)
  captureServerEvent(profile.id, 'sprint_action_toggled', { actionIndex })
  // Can now be called from any dashboard page (SprintActionCompletion), not
  // just the Sprint card on /dashboard itself — revalidate the whole
  // section so whichever page triggered this reflects the new state.
  revalidatePath('/dashboard', 'layout')
}

// Logging something from "More Actions Available" — it wasn't part of the
// locked commitment, so there's no existing row to toggle; this creates one
// already marked done/started, since logging it IS the action here.
export async function completeCatalogAction(formData: FormData) {
  const profile = await getAuthedProfile()
  if (!profile) return

  const text = formData.get('text') as string | null
  if (!text) return
  const actionType = (formData.get('actionType') as string | null) || undefined
  const effort = estimateActionEffort({ actionType })

  await logCatalogAction(profile.id, {
    text,
    actionType,
    points: effort.points,
    estimatedMinutes: effort.minutes,
    recurring: isRecurringActionType(actionType),
  })
  captureServerEvent(profile.id, 'catalog_action_completed', { actionType })
  revalidatePath('/dashboard', 'layout')
}
