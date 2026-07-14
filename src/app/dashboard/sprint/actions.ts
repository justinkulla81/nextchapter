'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { commitWeeklySprint, toggleSprintActionCompletion } from '@/lib/weekly/sprint'

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

  const count = Number(formData.get('actionCount') ?? 0)
  const actions: { text: string; actionType?: string; difficulty: 1 | 2 | 3 }[] = []

  for (let i = 0; i < count; i++) {
    if (formData.get(`selected_${i}`) !== 'on') continue
    const text = formData.get(`text_${i}`) as string | null
    if (!text) continue
    const actionType = (formData.get(`actionType_${i}`) as string | null) || undefined
    const difficulty = Number(formData.get(`difficulty_${i}`) ?? 2) as 1 | 2 | 3
    actions.push({ text, actionType, difficulty })
  }

  if (actions.length === 0) {
    return { error: 'Pick at least one action to commit to this week.' }
  }

  await commitWeeklySprint(profile.id, actions)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/sprint')
}

export async function toggleSprintAction(actionIndex: number) {
  const profile = await getAuthedProfile()
  if (!profile) return

  await toggleSprintActionCompletion(profile.id, actionIndex)
  revalidatePath('/dashboard')
}
