'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

export type PositioningFormState = { error?: string } | undefined

// Mandatory approval gate for the Dossier's Positioning Statement (Prompt
// 47) — an AI draft never becomes the final, Dossier-eligible text without
// this. The candidate can edit the draft before approving; whatever text
// they submit here is what gets saved as final.
export async function approvePositioningStatement(
  _prevState: PositioningFormState,
  formData: FormData
): Promise<PositioningFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You need to be logged in to do this.' }
  }

  const text = (formData.get('positioningStatementText') as string | null)?.trim()
  if (!text) {
    return { error: 'Please review the statement before approving it.' }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { positioningStatementText: text, positioningStatementSetAt: new Date() },
  })

  captureServerEvent(profile.id, 'dossier_positioning_statement_approved')
  revalidatePath('/dashboard/recruiter-report')
}
