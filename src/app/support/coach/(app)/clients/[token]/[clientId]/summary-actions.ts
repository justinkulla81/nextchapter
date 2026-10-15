'use server'

import { revalidatePath } from 'next/cache'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { captureServerEvent } from '@/lib/posthog/server'
import { generateNoteSummary } from '@/lib/coach/note-summary-service'

export type NoteSummaryState = { error?: string; message?: string } | undefined

export async function summarizeNotes(token: string, clientId: string, _prev: NoteSummaryState): Promise<NoteSummaryState> {
  const coach = await getCoachByToken(token)
  if (!coach) return { error: 'This link isn’t valid. Go back to your clients and open this one again.' }
  const client = await getCoachClient(coach.id, clientId)
  if (!client) return { error: 'This link isn’t valid. Go back to your clients and open this one again.' }

  const result = await generateNoteSummary(coach.id, client.id)
  if (!result.ok) return { error: result.error }
  captureServerEvent(coach.id, 'coach_note_summary_generated', { coachId: coach.id, candidateId: client.id })
  revalidatePath(`/support/coach/clients/${token}/${clientId}`)
  return { message: 'Summary updated.' }
}
