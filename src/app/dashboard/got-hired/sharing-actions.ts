'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'

// The candidate decides, per seat, whether their re-employment counts may be
// included in the sponsoring employer's anonymous aggregate scorecard. Default
// off. Only the seat's own candidate can change it, and changing it never tells
// the employer who did what. Revoking takes effect on the next report.
export async function setEmployerOutcomeSharing(seatId: string, share: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)

  const result = await prisma.outplacementSeat.updateMany({
    where: { id: seatId, candidateId: profile.id },
    data: { shareOutcomeWithEmployer: share, shareOutcomeChangedAt: new Date() },
  })
  if (result.count === 0) return { error: 'We could not find that program. Reload the page and try again.' }

  captureServerEvent(profile.id, 'employer_outcome_sharing_changed', { seatId, share })
  revalidatePath('/dashboard/got-hired')
  return {}
}
